import { pathToFileURL } from "node:url";
import { db } from "./connection.ts";
import { faqs } from "./schema.ts";

type FAQSeedEntry = Pick<typeof faqs.$inferInsert, "main_topic" | "question" | "answer">;

const faqSeedData: FAQSeedEntry[] = [
  {
	main_topic: "HEALTH",
	question: "Which smart wearable devices are compatible with CarboTrackr?",
	answer:
	  "CarboTrackr currently supports selected smart wearable devices. We are actively working on expanding compatibility with more devices.",
  },
  {
	main_topic: "HEALTH",
	question: "How does CarboTrackr sync heart rate data?",
	answer:
	  "- CarboTrackr syncs heart rate data periodically rather than continuously.\n- It collects readings from connected smart wearables and updates the database at scheduled times.\n- This approach reduces battery and data usage while keeping your records accurate and avoiding unnecessary duplicates.",
  },
  {
	main_topic: "HEALTH",
	question: "How does CarboTrackr sync step count data?",
	answer:
	  "- CarboTrackr syncs your daily step count once per day, usually in the evening or after your regular walking routine.\n- This provides a clear daily summary without draining battery or overloading the system.",
  },
  {
	main_topic: "FOOD_LOG",
	question: "I cannot find the food I want to log. Why?",
	answer:
	  "Some foods may not appear due to naming differences, regional products, or missing nutrition records. Try simpler search terms, brand names, or scanning a food label when available.",
  },
  {
	main_topic: "SCANNERS",
	question: "Why my drinks cannot be scanned by the Food Scanner?",
	answer:
	  "At the moment, CarboTrackr's Food Scanner can only recognize solid foods with labels or barcodes. It cannot scan unlabeled drinks because they often do not provide the packaging or nutrition details the scanner needs.",
  },
  {
	main_topic: "SCANNERS",
	question: "How to properly scan a food?",
	answer:
	  "Make sure the food is steady and in good lighting. Avoid glare or shadows, and hold still until the scan is confirmed.",
  },
  {
	main_topic: "SCANNERS",
	question: "How to properly scan a food packed with nutritional information?",
	answer:
	  "Make sure the packaged food is steady and in good lighting so the camera can clearly read the nutrition panel. Avoid glare or shadows, and hold still until the scan is confirmed.",
  },
];

const seed = () => async () => {
  console.log("🌱 Start FAQs seed...");

  try {
	console.log("Replacing FAQ records...");
	await db.delete(faqs);

	await db.insert(faqs).values(faqSeedData);

	console.log(`✅ Seeded ${faqSeedData.length} FAQ entries`);
  } catch (e) {
	console.error("❌ FAQs seed failed:", e);
  }
};

// Prevent automatic execution when the file is imported elsewhere.
if (import.meta.url === pathToFileURL(process.argv[1]!).href) {
  seed()()
	.then(() => process.exit(0))
	.catch(() => process.exit(1));
}

export default seed;

