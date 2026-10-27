import { expect, test } from "@playwright/test";
import en from "../messages/en.json";

test("missions list splits upcoming and completed events", async ({ page }) => {
  await page.goto("/en/missions");
  const upcoming = page.getByTestId("missions-upcoming");
  const completed = page.getByTestId("missions-completed");
  await expect(
    upcoming.getByRole("heading", {
      level: 2,
      name: en.Missions.upcomingTitle,
    }),
  ).toBeVisible();
  await expect(
    completed.getByRole("heading", {
      level: 2,
      name: en.Missions.completedTitle,
    }),
  ).toBeVisible();
  await expect(upcoming.getByTestId("event-card")).toHaveCount(3);
  await expect(upcoming).toContainText(
    "Sample mission trip to a village community",
  );
  await expect(completed.getByTestId("event-card")).toHaveCount(1);
  await expect(completed).toContainText("Sample past gathering");
  await completed.getByRole("link", { name: /Sample past gathering/ }).click();
  await expect(page).toHaveURL(/\/en\/missions\/sample-past-gathering$/);
});

test("completed mission detail shows location, date, report and gallery", async ({
  page,
}) => {
  await page.goto("/en/missions/sample-past-gathering");
  const detail = page.getByTestId("event-detail");
  await expect(
    page.getByRole("heading", { level: 1, name: "Sample past gathering" }),
  ).toBeVisible();
  await expect(detail).toContainText("Sample location");
  await expect(detail.locator("time")).toContainText("2026");
  await expect(detail).toContainText(en.EventStatuses.COMPLETED);
  await expect(
    page.getByRole("heading", { level: 2, name: en.EventDetail.about }),
  ).toBeVisible();
  await expect(page.getByTestId("event-report")).toContainText(
    "Sample trip report",
  );
  await expect(page.getByTestId("gallery-thumb")).toHaveCount(3);
});

test("the lightbox opens, cycles with the keyboard and returns focus", async ({
  page,
}) => {
  await page.goto("/en/missions/sample-past-gathering");
  const first = page.getByRole("button", {
    name: /^Open photo: Sample placeholder image 1/,
  });
  await first.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const counter = page.getByTestId("lightbox-counter");
  await expect(counter).toHaveText("Photo 1 of 3");
  await page.keyboard.press("ArrowRight");
  await expect(counter).toHaveText("Photo 2 of 3");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(counter).toHaveText("Photo 3 of 3");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(first).toBeFocused();
});

test("upcoming mission detail shows how to take part", async ({ page }) => {
  await page.goto("/ne/missions/sample-mission-trip");
  const volunteer = page.getByTestId("event-volunteer");
  await expect(volunteer).toContainText("नमूना पाठ: कसरी सहभागी हुने");
  await expect(
    volunteer.getByRole("link", { name: "सम्पर्क गर्नुहोस्" }),
  ).toHaveAttribute("href", "/ne/contact");
  await expect(
    page.getByText("कार्यक्रमपछि तस्बिरहरू थपिनेछन्।"),
  ).toBeVisible();
});
