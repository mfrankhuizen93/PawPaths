export async function readAuthorizedReviewRequest<TBody, TReviewer>(options: {
  readRequest: () => Promise<TBody>;
  authorize: () => Promise<TReviewer>;
}) {
  const body = await options.readRequest();
  const reviewer = await options.authorize();

  return { body, reviewer };
}
