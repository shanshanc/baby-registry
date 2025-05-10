// Category enum-like object
export const Category = {
  Feeding: "Feeding",
  Essential: "Essential",
  Sleeping: "Sleeping",
  Gear: "Gear",
  Toy: "Toy",
  Mom: "Mom",
  Donate: "Donate"
};

// Subcategory enum-like object
export const Subcategory = {
  Breastfeeding: "Breastfeeding",
  BottleFeeding: "Bottle-feeding",
  Bathing: "Bathing",
  BabyCare: "Baby Care",
  Travel: "Travel",
  Clothing: "Clothing",
  DonateQRCode: "Scan QR Code to Donate"
};

// Mapping from category to subcategories
export const CATEGORY_TO_SUBCATEGORIES = {
  [Category.Feeding]: [Subcategory.Breastfeeding, Subcategory.BottleFeeding],
  [Category.Essential]: [Subcategory.BabyCare, Subcategory.Bathing, Subcategory.Clothing],
  [Category.Gear]: [Subcategory.Travel],
  [Category.Donate]: [Subcategory.DonateQRCode]
};
