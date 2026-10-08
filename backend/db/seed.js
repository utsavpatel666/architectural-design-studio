const db = require("./db");

async function seed() {
  await db.initDb();

  const countResult = await db.query("SELECT COUNT(*) AS c FROM faqs");
  const faqCount = Number(countResult.rows[0].c);

  if (faqCount > 0) {
    console.log("FAQs already exist, skipping seed.");
    return;
  }

  const starterFaqs = [
    [
      "Do you offer free consultation?",
      "Yes, we offer a free initial consultation to understand your space and requirements.",
      1,
    ],
    [
      "How long does a typical project take?",
      "Depending on scope, most home interiors take 6-12 weeks from design approval to handover.",
      2,
    ],
    [
      "Do you provide 3D design previews?",
      "Yes, every project includes 3D visualizations before execution begins.",
      3,
    ],
    [
      "Which cities do you serve?",
      "We currently serve Ahmedabad and surrounding areas in Gujarat.",
      4,
    ],
  ];

  for (const [question, answer, sortOrder] of starterFaqs) {
    await db.query(
      `INSERT INTO faqs (question, answer, sort_order)
       VALUES ($1, $2, $3)`,
      [question, answer, sortOrder]
    );
  }

  console.log("Seeded starter FAQs.");
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed to seed PostgreSQL:", error);
    process.exit(1);
  });
