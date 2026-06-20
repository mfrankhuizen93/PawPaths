<template>
  <UCard>
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-3">
        <USkeleton class="size-10 rounded-full" />
        <div class="flex flex-1 flex-col gap-2">
          <USkeleton class="h-4 w-1/3" />
          <USkeleton class="h-3 w-1/2" />
        </div>
      </div>
      <USkeleton class="h-3 w-full" />
      <USkeleton class="h-3 w-4/5" />
    </div>
  </UCard>
</template>
