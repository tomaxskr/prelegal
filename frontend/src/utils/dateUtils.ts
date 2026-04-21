export function formatDate(dateStr: string): string {
  if (!dateStr) return "[Date]";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function getTermLabel(term: "1year" | "continues"): string {
  return term === "1year" ? "1 year(s)" : "continues until terminated";
}

export function getConfidentialityLabel(term: "1year" | "perpetuity"): string {
  return term === "1year"
    ? "1 year(s) from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws"
    : "in perpetuity";
}
