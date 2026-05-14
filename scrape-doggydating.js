import * as cheerio from "cheerio";
import fs from "node:fs/promises";
import pLimit from "p-limit";
import { inferLocationWarnings } from "./server/utils/location-warnings.js";

const BASE_URL = "https://www.doggydating.com";
const START_URL = `${BASE_URL}/hondenlosloopgebied/`;
const MAX_LISTING_PAGES = 100;
const JSON_OUTPUT_PATH = "doggydating-locations.json";
const META_OUTPUT_PATH = "doggydating-locations.meta.json";
const CACHE_SCHEMA_VERSION = 4;
const FORCE_REFRESH = process.argv.includes("--force");

const HEADERS = {
  "User-Agent": "Location research scraper - contact: your@email.com",
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchHtml(url) {
  await sleep(750);

  const res = await fetch(url, { headers: HEADERS });

  if (!res.ok) {
    throw new Error(`Failed ${res.status}: ${url}`);
  }

  return await res.text();
}

function absoluteUrl(href) {
  return new URL(href, BASE_URL).toString().split("#")[0];
}

function clean(text) {
  return text?.replace(/\s+/g, " ").trim() ?? "";
}

const TYPE_LABELS = new Map([
  ["strand", "beach"],
  ["park", "park"],
  ["natuurgebied", "nature reserve"],
  ["hondenspeeltuin", "dog playground"],
]);

const CHARACTERISTIC_LABELS = new Map([
  ["omheining", "fenced"],
  ["zwemwater", "swimming water"],
  ["wandelroutes", "walking trails"],
  ["horeca", "food and drink"],
  ["rolstoelvriendelijk", "wheelchair accessible"],
  ["ruiterpaden", "horse trails"],
  ["mtb", "mountain bike trails"],
  ["mtb-routes", "mountain bike trails"],
]);

function translateLabels(values, labels) {
  return [
    ...new Set(
      (values ?? [])
        .map((value) => labels.get(clean(value).toLowerCase()) ?? value)
        .filter(Boolean),
    ),
  ];
}

function normalizeLocation(location) {
  if (!location) return location;

  const normalizedLocation = { ...location };
  delete normalizedLocation.views;
  delete normalizedLocation.ratingSummary;
  const reviews = (normalizedLocation.reviews ?? []).filter(isReview);

  return {
    ...normalizedLocation,
    type: translateLabels(normalizedLocation.type, TYPE_LABELS),
    characteristics: translateLabels(
      normalizedLocation.characteristics,
      CHARACTERISTIC_LABELS,
    ),
    warnings: inferLocationWarnings(reviews),
    relatedUrls: normalizedLocation.relatedUrls ?? [],
    photos: normalizePhotos(normalizedLocation.photos),
    reviews,
  };
}

function normalizePhotos(photos = []) {
  const seen = new Set();

  return photos
    .map((photo) => ({
      url: photo?.url,
      alt: clean(photo?.alt) || null,
    }))
    .filter((photo) => {
      if (!photo.url || seen.has(photo.url)) return false;
      seen.add(photo.url);
      return true;
    });
}

function isLocationDetailUrl(url) {
  const { pathname } = new URL(url);

  return (
    pathname.startsWith("/hondenlosloopgebied/") &&
    pathname !== "/hondenlosloopgebied/" &&
    !/^\/hondenlosloopgebied\/page\/\d+\/?$/.test(pathname)
  );
}

function getNextListingUrl($, currentUrl) {
  const nextHref =
    $('[rel="next"]').attr("href") ??
    $("a")
      .filter((_, el) => /volgende/i.test(clean($(el).text())))
      .first()
      .attr("href");

  if (!nextHref) return null;

  const nextUrl = absoluteUrl(nextHref);

  return nextUrl === currentUrl ? null : nextUrl;
}

function extractLocationCount($) {
  const pageText = clean($("body").text());
  const match = pageText.match(/(\d+)\s+losloopgebieden/i);

  return match ? Number(match[1]) : null;
}

function collectLocationUrls($, urls) {
  const before = urls.size;

  $('a[href*="/hondenlosloopgebied/"]').each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    const fullUrl = absoluteUrl(href);

    if (isLocationDetailUrl(fullUrl)) {
      urls.add(fullUrl);
    }
  });

  return urls.size - before;
}

function shouldSkipRelatedUrl(url, locationUrl) {
  const parsed = new URL(url);

  return (
    url === locationUrl ||
    parsed.protocol === "mailto:" ||
    parsed.protocol === "tel:" ||
    parsed.pathname.startsWith("/wp-content/") ||
    parsed.pathname.startsWith("/wp-admin/") ||
    parsed.pathname.startsWith("/wp-login") ||
    isLocationDetailUrl(url) ||
    parsed.pathname === "/hondenlosloopgebied/" ||
    /^\/hondenlosloopgebied\/page\/\d+\/?$/.test(parsed.pathname)
  );
}

function collectLinksFromElements($, elements, locationUrl, relatedUrls) {
  elements.find("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;

    const url = absoluteUrl(href);
    if (shouldSkipRelatedUrl(url, locationUrl)) return;

    relatedUrls.set(url, {
      label: clean($(el).text()) || null,
      url,
    });
  });
}

async function readCachedLocations() {
  try {
    const file = await fs.readFile(JSON_OUTPUT_PATH, "utf8");
    const locations = JSON.parse(file);

    return Array.isArray(locations) ? locations.map(normalizeLocation) : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function readCacheMetadata() {
  try {
    const file = await fs.readFile(META_OUTPUT_PATH, "utf8");
    return JSON.parse(file);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function getListingSnapshot() {
  console.log(`Checking listing count: ${START_URL}`);

  const html = await fetchHtml(START_URL);
  const $ = cheerio.load(html);

  return {
    html,
    count: extractLocationCount($),
  };
}

async function getLocationUrls(firstPageHtml) {
  const urls = new Set();
  const seenListingUrls = new Set();

  let page = 1;
  let url = START_URL;

  while (url && !seenListingUrls.has(url) && page <= MAX_LISTING_PAGES) {
    seenListingUrls.add(url);

    console.log(`Fetching listing page ${page}: ${url}`);

    const html =
      page === 1 && firstPageHtml ? firstPageHtml : await fetchHtml(url);
    const $ = cheerio.load(html);

    const added = collectLocationUrls($, urls);
    console.log(`Found ${added} new location URLs on page ${page}`);

    url = getNextListingUrl($, url);
    page += 1;
  }

  return [...urls];
}

function extractCoordinates($) {
  const routeLink = $("a")
    .filter((_, el) => clean($(el).text()).match(/plan je route/i))
    .attr("href");

  if (!routeLink) return { latitude: null, longitude: null };

  const decoded = decodeURIComponent(routeLink);

  const match = decoded.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);

  if (!match) return { latitude: null, longitude: null };

  return {
    latitude: Number(match[1]),
    longitude: Number(match[2]),
  };
}

function extractRelatedUrls($, locationUrl) {
  const relatedUrls = new Map();

  const routeLink = $("a")
    .filter((_, el) => clean($(el).text()).match(/plan je route/i))
    .attr("href");

  if (routeLink) {
    const url = absoluteUrl(routeLink);
    if (!shouldSkipRelatedUrl(url, locationUrl)) {
      relatedUrls.set(url, {
        label: "Directions",
        url,
      });
    }
  }

  $("h2").each((_, el) => {
    const heading = clean($(el).text());

    if (!/honden los in/i.test(heading)) return;

    const sectionElements = [];
    let next = $(el).next();

    while (next.length && next[0].tagName !== "h2") {
      sectionElements.push(next[0]);
      next = next.next();
    }

    collectLinksFromElements($, $(sectionElements), locationUrl, relatedUrls);
  });

  return [...relatedUrls.values()];
}

function extractTypeAndCharacteristics($) {
  const type = new Set();
  const characteristics = new Set();

  $("img[alt]").each((_, el) => {
    const alt = clean($(el).attr("alt")).toLowerCase();
    const typeLabel = TYPE_LABELS.get(alt);
    const characteristicLabel = CHARACTERISTIC_LABELS.get(alt);

    if (typeLabel) type.add(typeLabel);
    if (characteristicLabel) characteristics.add(characteristicLabel);
  });

  return {
    type: [...type],
    characteristics: [...characteristics],
  };
}

function getImageUrl($, element) {
  const src =
    $(element).attr("data-lazy-src") ??
    $(element).attr("data-src") ??
    $(element).attr("src");

  if (!src || src.startsWith("data:")) return null;

  return absoluteUrl(src);
}

function extractPhotos($) {
  const photos = new Map();

  $(".sz_slider_container img").each((_, el) => {
    const url = getImageUrl($, el);
    if (!url || !url.includes("/wp-content/uploads/")) return;

    photos.set(url, {
      url,
      alt: clean($(el).attr("alt")) || null,
    });
  });

  return [...photos.values()];
}

function extractReviews($, locationName) {
  const reviews = [];

  const reviewHeading = $("body")
    .text()
    .match(/Gemiddelde beoordeling/i);

  if (!reviewHeading) return reviews;

  $(".review").each((_, el) => {
    const reviewElement = $(el);
    const title = clean(reviewElement.find("h3").first().text());

    if (!title) return;

    const date =
      clean(reviewElement.find(".review-date").first().text()) || null;
    const rating = extractRating(reviewElement.find(".rating-bar").first());
    const text = clean(
      reviewElement
        .children("div")
        .filter((_, child) => !$(child).hasClass("rating-wrapper"))
        .last()
        .text(),
    );

    const review = {
      reviewer: title.replace(`– ${locationName}`, "").trim(),
      date,
      rating,
      text,
    };

    if (isReview(review)) {
      reviews.push({
        reviewer: review.reviewer,
        date,
        rating,
        text: review.text,
      });
    }
  });

  return reviews;
}

function extractRating(element) {
  const style = element.attr("style") ?? "";
  const match = style.match(/--rating:\s*([0-9.]+)/);
  const rating = match ? Number(match[1]) : null;

  return Number.isFinite(rating) ? rating : null;
}

function isReview(review) {
  if (!review?.reviewer || !review?.text) return false;

  const text = clean(review.text);

  return !(!review.date && /^meer informatie$/i.test(text));
}

function extractDescription($) {
  const paragraphs = [];

  $("h2").each((_, el) => {
    const heading = clean($(el).text());

    if (!/honden los in/i.test(heading)) return;

    let next = $(el).next();

    while (next.length && next[0].tagName !== "h2") {
      if (next[0].tagName === "p") {
        const text = clean(next.text());
        if (text) paragraphs.push(text);
      }

      next = next.next();
    }
  });

  return paragraphs.join("\n\n");
}

function guessCityFromUrl(url) {
  const slug = new URL(url).pathname.split("/").filter(Boolean).at(-1);

  if (!slug) return null;

  const parts = slug.split("-");
  return parts.at(-1)?.replace(/\b\w/g, (c) => c.toUpperCase()) ?? null;
}

async function scrapeLocation(url) {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const name = clean($("h1").first().text()) || null;

  const { latitude, longitude } = extractCoordinates($);
  const { type, characteristics } = extractTypeAndCharacteristics($);

  return {
    url,
    name,
    cityGuess: guessCityFromUrl(url),
    province: null,
    latitude,
    longitude,
    type,
    characteristics,
    description: extractDescription($),
    relatedUrls: extractRelatedUrls($, url),
    photos: extractPhotos($),
    reviews: extractReviews($, name),
  };
}

async function main() {
  const cachedLocations = await readCachedLocations();
  const cacheMetadata = await readCacheMetadata();
  const { html: firstPageHtml, count: listingCount } =
    await getListingSnapshot();
  const cachedListingCount =
    cacheMetadata?.listingCount ?? cachedLocations.length;
  const cacheSchemaVersion = cacheMetadata?.schemaVersion ?? 1;
  const needsFullDetailRefresh =
    FORCE_REFRESH || cacheSchemaVersion < CACHE_SCHEMA_VERSION;

  if (
    !FORCE_REFRESH &&
    !needsFullDetailRefresh &&
    cachedLocations.length > 0 &&
    listingCount !== null &&
    cachedListingCount === listingCount
  ) {
    console.log(
      `Location count unchanged (${listingCount}); using ${JSON_OUTPUT_PATH}`,
    );
    await fs.writeFile(
      JSON_OUTPUT_PATH,
      JSON.stringify(cachedLocations, null, 2),
      "utf8",
    );

    if (!cacheMetadata) {
      await fs.writeFile(
        META_OUTPUT_PATH,
        JSON.stringify(
          {
            schemaVersion: CACHE_SCHEMA_VERSION,
            listingCount,
            urlCount: cachedLocations.length,
            updatedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
        "utf8",
      );
    }

    console.log("Done:");
    console.log(`- ${JSON_OUTPUT_PATH}`);
    console.log(`- ${META_OUTPUT_PATH}`);
    return;
  }

  if (FORCE_REFRESH) {
    console.log("Force refresh requested; refreshing all location details");
  } else if (needsFullDetailRefresh) {
    console.log(
      `Cache schema changed from ${cacheSchemaVersion} to ${CACHE_SCHEMA_VERSION}; refreshing all location details`,
    );
  } else if (cachedLocations.length > 0 && listingCount !== null) {
    console.log(
      `Location count changed: cached source count ${cachedListingCount}, listing ${listingCount}`,
    );
  } else if (cachedLocations.length > 0) {
    console.log(
      "Could not read listing count; refreshing the location URL list",
    );
  } else {
    console.log("No cached locations found; scraping from scratch");
  }

  const urls = await getLocationUrls(firstPageHtml);

  console.log(`Found ${urls.length} location URLs`);

  const cachedByUrl = new Map(
    cachedLocations
      .filter((location) => location?.url)
      .map((location) => [location.url, location]),
  );
  const urlsToScrape = needsFullDetailRefresh
    ? urls
    : urls.filter((url) => !cachedByUrl.has(url));

  console.log(
    `Reusing ${urls.length - urlsToScrape.length} cached locations; scraping ${urlsToScrape.length} new locations`,
  );

  const limit = pLimit(3);

  const results = await Promise.allSettled(
    urlsToScrape.map((url) =>
      limit(async () => {
        console.log(`Scraping ${url}`);
        return await scrapeLocation(url);
      }),
    ),
  );

  const scrapedLocations = results.map((result, index) => {
    if (result.status === "fulfilled") return result.value;

    return {
      url: urlsToScrape[index],
      error: result.reason.message,
    };
  });

  const scrapedByUrl = new Map(
    scrapedLocations
      .filter((location) => location?.url)
      .map((location) => [location.url, location]),
  );
  const locations = urls.map(
    (url) => scrapedByUrl.get(url) ?? cachedByUrl.get(url),
  );

  await fs.writeFile(
    JSON_OUTPUT_PATH,
    JSON.stringify(locations.map(normalizeLocation), null, 2),
    "utf8",
  );
  await fs.writeFile(
    META_OUTPUT_PATH,
    JSON.stringify(
      {
        schemaVersion: CACHE_SCHEMA_VERSION,
        listingCount,
        urlCount: urls.length,
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log("Done:");
  console.log(`- ${JSON_OUTPUT_PATH}`);
  console.log(`- ${META_OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
