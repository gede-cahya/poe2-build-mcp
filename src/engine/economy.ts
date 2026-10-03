/**
 * PoE2 Live Economy & Market Integration
 *
 * Integrates with poe2scout API (https://api.poe2scout.com/poe2)
 * for real-time currency ratios (Divine, Mirror, Exalted) and unique item prices.
 */

const API_BASE = "https://api.poe2scout.com/poe2";

export interface LeagueInfo {
  name: string;
  isCurrent: boolean;
  divineInExalts: number;
  divineIconUrl: string;
  exaltedIconUrl: string;
}

export interface MarketItemResult {
  name: string;
  category: string;
  priceExalted: number;
  priceDivine: number;
  quantity: number;
  iconUrl?: string;
  markdownImage?: string;
  lastUpdated?: string;
}

export interface BuildBudgetItem {
  name: string;
  itemClass?: string;
  priceExalted: number;
  priceDivine: number;
  iconUrl?: string;
  markdownImage?: string;
  found: boolean;
}

export interface BuildBudgetResult {
  league: string;
  divineRateExalted: number;
  totalExalted: number;
  totalDivine: number;
  tier: "Budget (< 5 Div)" | "Mid-Tier (5 - 30 Div)" | "Endgame (30 - 150 Div)" | "Mirror-Tier (> 150 Div)";
  items: BuildBudgetItem[];
  summaryMarkdown: string;
}

// In-memory cache for 5 minutes
const leagueCache: { timestamp: number; data: LeagueInfo[] } = {
  timestamp: 0,
  data: [],
};

export async function fetchLeagues(): Promise<LeagueInfo[]> {
  const now = Date.now();
  if (now - leagueCache.timestamp < 300_000 && leagueCache.data.length > 0) {
    return leagueCache.data;
  }

  try {
    const res = await fetch(`${API_BASE}/Leagues`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: any[] = await res.json();
    const parsed: LeagueInfo[] = data.map((l) => ({
      name: l.Value,
      isCurrent: l.IsCurrent ?? false,
      divineInExalts: l.DivinePrice ?? 1,
      divineIconUrl: l.DivineCurrencyIconUrl || "",
      exaltedIconUrl: l.ExaltedCurrencyIconUrl || "",
    }));
    leagueCache.timestamp = now;
    leagueCache.data = parsed;
    return parsed;
  } catch (err) {
    // Fallback if offline
    return [
      {
        name: "Runes of Aldur",
        isCurrent: true,
        divineInExalts: 434.4,
        divineIconUrl: "https://web.poecdn.com//gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lNb2RWYWx1ZXMiLCJzY2FsZSI6MSwicmVhbG0iOiJwb2UyIn1d/2986e220b3/CurrencyModValues.png",
        exaltedIconUrl: "https://web.poecdn.com//gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lBZGRNb2RUb1JhcmUiLCJzY2FsZSI6MSwicmVhbG0iOiJwb2UyIn1d/ad7c366789/CurrencyAddModToRare.png",
      },
      {
        name: "Standard",
        isCurrent: false,
        divineInExalts: 174.2,
        divineIconUrl: "https://web.poecdn.com//gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lNb2RWYWx1ZXMiLCJzY2FsZSI6MSwicmVhbG0iOiJwb2UyIn1d/2986e220b3/CurrencyModValues.png",
        exaltedIconUrl: "https://web.poecdn.com//gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lBZGRNb2RUb1JhcmUiLCJzY2FsZSI6MSwicmVhbG0iOiJwb2UyIn1d/ad7c366789/CurrencyAddModToRare.png",
      },
    ];
  }
}

export async function getMarketPrice(
  query: string,
  targetLeague: string = "Runes of Aldur"
): Promise<MarketItemResult[]> {
  const leagues = await fetchLeagues();
  const matchedLeague =
    leagues.find((l) => l.name.toLowerCase() === targetLeague.toLowerCase()) ||
    leagues.find((l) => l.isCurrent) ||
    leagues[0];

  const leagueParam = encodeURIComponent(matchedLeague.name);
  const divRate = matchedLeague.divineInExalts > 0 ? matchedLeague.divineInExalts : 434;

  const results: MarketItemResult[] = [];
  const qLower = query.toLowerCase().trim();

  // 1. Check currencies
  try {
    const curRes = await fetch(
      `${API_BASE}/Leagues/${leagueParam}/Currencies/ByCategory?category=currency`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (curRes.ok) {
      const curData: any = await curRes.json();
      for (const item of curData.Items || []) {
        if (
          !qLower ||
          item.Text.toLowerCase().includes(qLower) ||
          (item.ApiId && item.ApiId.toLowerCase().includes(qLower))
        ) {
          const priceEx = item.CurrentPrice ?? 0;
          const priceDiv = Number((priceEx / divRate).toFixed(4));
          const icon = item.IconUrl || item.ItemMetadata?.icon;
          results.push({
            name: item.Text,
            category: "Currency",
            priceExalted: priceEx,
            priceDivine: priceDiv,
            quantity: item.CurrentQuantity ?? 0,
            iconUrl: icon,
            markdownImage: icon ? `![${item.Text}](${icon})` : undefined,
          });
        }
      }
    }
  } catch {
    // Continue
  }

  // 2. Check unique categories (weapon, armour, accessory, jewel, flask)
  const categories = ["weapon", "armour", "accessory", "jewel", "flask"];
  for (const cat of categories) {
    if (results.length >= 20) break;
    try {
      const uRes = await fetch(
        `${API_BASE}/Leagues/${leagueParam}/Uniques/ByCategory?category=${cat}`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (uRes.ok) {
        const uData: any = await uRes.json();
        for (const item of uData.Items || []) {
          if (!qLower || item.Text.toLowerCase().includes(qLower)) {
            const priceEx = item.CurrentPrice ?? 0;
            const priceDiv = Number((priceEx / divRate).toFixed(3));
            const icon = item.IconUrl || item.ItemMetadata?.icon;
            results.push({
              name: item.Text,
              category: `Unique ${cat.charAt(0).toUpperCase() + cat.slice(1)}`,
              priceExalted: priceEx,
              priceDivine: priceDiv,
              quantity: item.CurrentQuantity ?? 0,
              iconUrl: icon,
              markdownImage: icon ? `![${item.Text}](${icon})` : undefined,
            });
            if (results.length >= 25) break;
          }
        }
      }
    } catch {
      // Continue
    }
  }

  return results;
}

export async function calculateBuildBudget(
  itemNames: string[],
  targetLeague: string = "Runes of Aldur"
): Promise<BuildBudgetResult> {
  const leagues = await fetchLeagues();
  const matchedLeague =
    leagues.find((l) => l.name.toLowerCase() === targetLeague.toLowerCase()) ||
    leagues.find((l) => l.isCurrent) ||
    leagues[0];

  const divRate = matchedLeague.divineInExalts > 0 ? matchedLeague.divineInExalts : 434;

  const budgetItems: BuildBudgetItem[] = [];
  let totalEx = 0;

  for (const name of itemNames) {
    const market = await getMarketPrice(name, matchedLeague.name);
    // Best match: exact or startsWith
    const exact =
      market.find((m) => m.name.toLowerCase() === name.toLowerCase()) ||
      market.find((m) => m.name.toLowerCase().includes(name.toLowerCase())) ||
      market[0];

    if (exact) {
      budgetItems.push({
        name: exact.name,
        itemClass: exact.category,
        priceExalted: exact.priceExalted,
        priceDivine: exact.priceDivine,
        iconUrl: exact.iconUrl,
        markdownImage: exact.markdownImage,
        found: true,
      });
      totalEx += exact.priceExalted;
    } else {
      budgetItems.push({
        name,
        priceExalted: 0,
        priceDivine: 0,
        found: false,
      });
    }
  }

  const totalDiv = Number((totalEx / divRate).toFixed(2));

  let tier: BuildBudgetResult["tier"] = "Budget (< 5 Div)";
  if (totalDiv > 150) {
    tier = "Mirror-Tier (> 150 Div)";
  } else if (totalDiv >= 30) {
    tier = "Endgame (30 - 150 Div)";
  } else if (totalDiv >= 5) {
    tier = "Mid-Tier (5 - 30 Div)";
  }

  const itemLines = budgetItems.map((b) => {
    if (!b.found) {
      return `- **${b.name}**: *(No market data)*`;
    }
    const img = b.iconUrl ? `![${b.name}](${b.iconUrl}) ` : "";
    return `- ${img}**${b.name}** (${b.itemClass}): **${b.priceDivine} Div** (${Math.round(b.priceExalted).toLocaleString()} Ex)`;
  });

  const summaryMarkdown = [
    `### 💰 Build Budget Breakdown (${matchedLeague.name})`,
    `- **Total Cost:** **${totalDiv.toLocaleString()} Divine Orbs** (~${Math.round(totalEx).toLocaleString()} Exalted Orbs)`,
    `- **Budget Tier:** **${tier}**`,
    `- **Current Divine Ratio:** 1 Divine = ${divRate.toFixed(1)} Exalted Orbs`,
    `\n#### Required Items:`,
    ...itemLines,
  ].join("\n");

  return {
    league: matchedLeague.name,
    divineRateExalted: divRate,
    totalExalted: Math.round(totalEx),
    totalDivine: totalDiv,
    tier,
    items: budgetItems,
    summaryMarkdown,
  };
}
