<script lang="ts" setup>
import { footerNavigationItems } from "~/navigation/items";
</script>

<template>
  <UFooter
    :ui="{
      container: 'h-18 w-full p-0',
      center: 'm-0 flex w-full flex-col',
      left: 'm-0',
    }"
    class="bg-default/95 fixed inset-x-0 bottom-0 z-50 backdrop-blur lg:hidden"
  >
    <USeparator />
    <UNavigationMenu
      :items="footerNavigationItems"
      :ui="{
        root: 'justify-center [&>div]:w-full',
        item: 'w-full py-0',
        list: 'w-full mt-0',
        link: 'flex-col justify-center gap-1 px-3 h-18',
        linkLeadingIcon: 'size-5',
        linkLabel: 'text-[10px]/3 font-normal',
      }"
      class="w-full"
    />
  </UFooter>
</template>

<style scoped></style>
