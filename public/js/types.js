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

// Category Mandarin translations
export const CategoryZH = {
  [Category.Feeding]: "哺乳",
  [Category.Essential]: "生活用品",
  [Category.Sleeping]: "嬰兒床寢具",
  [Category.Gear]: "外出用品",
  [Category.Toy]: "玩具",
  [Category.Mom]: "媽媽用品",
  [Category.Donate]: "直接贊助"
};

// Subcategory enum-like object
export const Subcategory = {
  Breastfeeding: "Breastfeeding",
  Bottlefeeding: "Bottlefeeding",
  Bathing: "Bathing",
  BabyCare: "BabyCare",
  Travel: "Travel",
  Clothing: "Clothing",
  Toy: "Toy",
  Mom: "Mom",
  DonateQRCode: "DonateQRCode",
  None: "None"
};

// Subcategory Mandarin translations
export const SubcategoryZH = {
  [Subcategory.Breastfeeding]: "母乳哺餵",
  [Subcategory.Bottlefeeding]: "奶瓶奶嘴週邊",
  [Subcategory.Bathing]: "沐浴清潔",
  [Subcategory.BabyCare]: "嬰兒護理",
  [Subcategory.Travel]: "外出用品",
  [Subcategory.Clothing]: "童裝",
  [Subcategory.Toy]: "玩具",
  [Subcategory.Mom]: "媽媽用品",
  [Subcategory.DonateQRCode]: "掃描QR碼贊助",
  [Subcategory.None]: "一般"
};

// Mapping from category to subcategories
export const CATEGORY_TO_SUBCATEGORIES = {
  [Category.Feeding]: [Subcategory.None, Subcategory.Breastfeeding, Subcategory.Bottlefeeding],
  [Category.Essential]: [Subcategory.None, Subcategory.BabyCare, Subcategory.Bathing, Subcategory.Clothing],
  [Category.Gear]: [Subcategory.None, Subcategory.Travel],
  [Category.Toy]: [Subcategory.None, Subcategory.Toy],
  [Category.Mom]: [Subcategory.None, Subcategory.Mom],
  [Category.Donate]: [Subcategory.DonateQRCode]
};

// UI Text Constants for Claims
export const ClaimText = {
  CLAIM: "認領",           // Button text for claiming an item
  CLAIMED: "已認領",       // Text showing an item is claimed
  SAVING: "Saving...",    // Text during save operation
  AVAILABLE: "Available",  // Text for available status
  TAKEN: "Taken"          // Text for taken status
};
