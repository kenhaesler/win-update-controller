import type { Page } from "@playwright/test";
export async function openToolbarMenu(page: Page, name: string) {
  const trigger = page.getByRole("button", { name, exact: true });
  if (await trigger.locator("..").getAttribute("open") === null) await trigger.click();
}
