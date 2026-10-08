const samplePackages = [
  {
    name: "2BHK",
    inclusions: ["Space planning", "Modular kitchen", "Wardrobes", "Lighting plan"],
    plans: [
      { name: "Silver", price: 600000, note: "A polished essential foundation.", is_popular: false },
      { name: "Gold", price: 900000, note: "More storage and refined detailing.", is_popular: true },
      { name: "Platinum", price: 1250000, note: "A fully tailored elevated finish.", is_popular: false },
    ],
  },
  {
    name: "3BHK",
    inclusions: ["Space planning", "Modular kitchen", "Wardrobes", "Lighting plan", "Custom furniture"],
    plans: [
      { name: "Silver", price: 850000, note: "A polished essential foundation.", is_popular: false },
      { name: "Gold", price: 1200000, note: "More storage and refined detailing.", is_popular: true },
      { name: "Platinum", price: 1650000, note: "A fully tailored elevated finish.", is_popular: false },
    ],
  },
  {
    name: "4BHK+",
    inclusions: ["Space planning", "Modular kitchen", "Wardrobes", "Lighting plan", "Custom furniture", "Styling direction"],
    plans: [
      { name: "Silver", price: 1200000, note: "A polished essential foundation.", is_popular: false },
      { name: "Gold", price: 1700000, note: "More storage and refined detailing.", is_popular: true },
      { name: "Platinum", price: 2400000, note: "A fully tailored elevated finish.", is_popular: false },
    ],
  },
  {
    name: "Commercial",
    inclusions: ["Space planning", "Reception design", "Workstations", "Lighting plan", "Brand detailing"],
    plans: [
      { name: "Essential", price: 700000, note: "A focused, efficient workplace base.", is_popular: true },
      { name: "Signature", price: 1350000, note: "A stronger branded client experience.", is_popular: false },
    ],
  },
];

async function seedPackages(db) {
  const existing = await db.query("SELECT COUNT(*) AS count FROM home_types");
  if (Number(existing.rows[0].count) > 0) return;

  for (const [typeIndex, homeType] of samplePackages.entries()) {
    const typeResult = await db.query(
      `INSERT INTO home_types (name, inclusions, sort_order, is_active)
       VALUES ($1, $2, $3, true) RETURNING id`,
      [homeType.name, homeType.inclusions, typeIndex]
    );
    const homeTypeId = typeResult.rows[0].id;
    for (const [planIndex, plan] of homeType.plans.entries()) {
      await db.query(
        `INSERT INTO plans (home_type_id, name, price, note, is_popular, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [homeTypeId, plan.name, plan.price, plan.note, plan.is_popular, planIndex]
      );
    }
  }
}

module.exports = { samplePackages, seedPackages };
