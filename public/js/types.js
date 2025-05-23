// Category enum-like object
const Category = {
  Feeding: "Feeding",
  Sleeping: "Sleeping",
  Essential: "Essential",
  Gear: "Gear",
  Toy: "Toy",
  Mom: "Mom",
  Donate: "Donate"
};

// Subcategory enum-like object
const Subcategory = {
  FEED_None: "FEED_None",
  FEED_Breastfeeding: "FEED_Breastfeeding",
  FEED_Bottlefeeding: "FEED_Bottlefeeding",
  FEED_Electronics: "FEED_Electronics",
  SLEP_None: "SLEP_None",
  SLEP_Clothing: "SLEP_Clothing",
  SLEP_Electronics: "SLEP_Electronics",
  ESSN_BabyCare: "ESSN_BabyCare",
  ESSN_Cleaning: "ESSN_Cleaning",
  ESSN_Bathing: "ESSN_Bathing",
  ESSN_Bibs: "ESSN_Bibs",
  ESSN_Clothing: "ESSN_Clothing",
  ESSN_Diapers: "ESSN_Diapers",
  ESSN_Outdoor: "ESSN_Outdoor",
  GEAR_None: "GEAR_None",
  GEAR_HomeSafety: "GEAR_HomeSafety",
  GEAR_Outdoor: "GEAR_Outdoor",
  TOY_None: "TOY_None",
  MOM_None: "MOM_None",
  DONATE_None: "DONATE_None"
};

const CategoryToSubcategories = {
  [Category.Feeding]: [Subcategory.FEED_None, Subcategory.FEED_Breastfeeding, Subcategory.FEED_Bottlefeeding, Subcategory.FEED_Electronics],
  [Category.Sleeping]: [Subcategory.SLEP_None, Subcategory.SLEP_Clothing, Subcategory.SLEP_Electronics],
  [Category.Essential]: [Subcategory.ESSN_BabyCare, Subcategory.ESSN_Cleaning, Subcategory.ESSN_Bathing, Subcategory.ESSN_Bibs, Subcategory.ESSN_Clothing, Subcategory.ESSN_Diapers, Subcategory.ESSN_Outdoor],
  [Category.Gear]: [Subcategory.GEAR_None, Subcategory.GEAR_HomeSafety, Subcategory.GEAR_Outdoor],
  [Category.Toy]: [Subcategory.TOY_None],
  [Category.Mom]: [Subcategory.MOM_None],
  [Category.Donate]: [Subcategory.DONATE_None]
};

// UI Text Constants for Claims
const ClaimText = {
  CLAIM: "認領",           // Button text for claiming an item
  CLAIMED: "已認領",       // Text showing an item is claimed
  SAVING: "Saving...",    // Text during save operation
  AVAILABLE: "Available",  // Text for available status
  TAKEN: "Taken"          // Text for taken status
};

export { Category, Subcategory, CategoryToSubcategories, ClaimText };
