import { Generations } from '@smogon/calc';

const SIMPLIFIED_TO_TRADITIONAL: Record<string, string> = {
  '龙': '龍', '喷': '噴', '针': '針', '宝': '寶', '吓': '嚇', '电': '電', '击': '擊', '鱼': '魚',
  '鸟': '鳥', '兰': '蘭', '丽': '麗', '亚': '亞', '败': '敗', '球': '球', '菇': '菇', '发': '髮',
  '药': '藥', '草': '草', '虫': '蟲', '兽': '獸', '极': '極', '速': '速', '折': '折', '返': '返',
  '无': '無', '线': '線', '盖': '蓋', '罗': '羅', '双': '雙', '翼': '翼', '钢': '鋼', '铁': '鐵',
  '银': '銀', '铜': '銅', '金': '金', '钟': '鐘', '锋': '鋒', '伤': '傷', '响': '響',
  '玛': '瑪', '骑': '騎', '纳': '納', '欧': '歐', '轰': '轟', '闪': '閃', '伟': '偉', '颈': '頸',
  '恶': '惡', '简': '簡', '蜗': '蝸', '尔': '爾', '战': '戰', '圣': '聖', '连': '連', '强': '強',
  '万': '萬', '冻': '凍', '动': '動', '剑': '劍', '盾': '盾', '铠': '鎧',
  // Additional comprehensive VGC character mappings
  '饭': '飯', '头': '頭', '气': '氣', '势': '勢', '带': '帶'
};

const CHINESE_TO_ENGLISH_ITEMS: Record<string, string> = {
  '凹凸頭盔': 'Rocky Helmet',
  '突擊背心': 'Assault Vest',
  '生命寶珠': 'Life Orb',
  '生命珠': 'Life Orb',
  '命玉': 'Life Orb',
  '吃剩的東西': 'Leftovers',
  '剩飯': 'Leftovers',
  '氣勢披帶': 'Focus Sash',
  '氣勢披帶 ': 'Focus Sash',
  '氣腰': 'Focus Sash',
  '文柚果': 'Sitrus Berry',
  '講究頭帶': 'Choice Band',
  '專愛頭帶': 'Choice Band',
  '講究眼鏡': 'Choice Specs',
  '專愛眼鏡': 'Choice Specs',
  '講究圍巾': 'Choice Scarf',
  '專愛圍巾': 'Choice Scarf',
  '木子果': 'Lum Berry',
  '避難背包': 'Eject Pack',
  '紅線': 'Destiny Knot',
  '黑鐵球': 'Iron Ball',
  '光之黏土': 'Light Clay',
  '弱點保險': 'Weakness Policy',
  '安全護目鏡': 'Safety Goggles',
  '防塵護目鏡': 'Safety Goggles',
  '氣球': 'Air Balloon',
  '紅牌': 'Red Card',
  '脫逃按鍵': 'Eject Button',
  '逃脫按鍵': 'Eject Button',
  '特性護具': 'Ability Shield',
  '密探斗篷': 'Covert Cloak',
  '清淨墜飾': 'Clear Amulet',
  '驅動能量': 'Booster Energy'
};

export function convertSCtoTC(str: string): string {
  if (!str) return '';
  return str.split('').map(char => SIMPLIFIED_TO_TRADITIONAL[char] || char).join('');
}

function getLevenshteinDistance(a: string, b: string): number {
  const tmp: number[][] = [];
  for (let i = 0; i <= a.length; i++) tmp[i] = [i];
  for (let j = 0; j <= b.length; j++) tmp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return tmp[a.length][b.length];
}

function getSimilarity(s1: string, s2: string): number {
  let longer = s1, shorter = s2;
  if (s1.length < s2.length) { longer = s2; shorter = s1; }
  const longerLength = longer.length;
  if (longerLength === 0) return 1.0;
  return (longerLength - getLevenshteinDistance(longer, shorter)) / longerLength;
}

export interface MatchResult<T> {
  match: T;
  originalQuery: string;
  resolvedName: string;
  isFuzzy: boolean;
}

function normalize(str: string | undefined | null): string {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeZh(str: string | undefined | null): string {
  if (!str) return '';
  return convertSCtoTC(str).toLowerCase().replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '');
}

export function matchSpecies(query: string, pokemonList: any[]): MatchResult<any> | null {
  if (!query) return null;
  const isChinese = /[\u4e00-\u9fa5]/.test(query);

  if (isChinese) {
    const tcQuery = normalizeZh(query);
    
    // 1. Exact match first
    const exact = pokemonList.find(p => p.nameZh && normalizeZh(p.nameZh) === tcQuery);
    if (exact) return { match: exact, originalQuery: query, resolvedName: exact.nameZh || exact.nameEn, isFuzzy: false };

    // 2. Chinese Mega regex translation match
    const megaMatch = query.match(/^超級(.+)|(.+)[- ]?(mega|超級|超|m)[- ]?(x|y)?$/i);
    if (megaMatch) {
      const base = (megaMatch[1] || megaMatch[2] || '').replace(/[- ]+$/, '').trim();
      const suffix = (megaMatch[4] || '').toUpperCase();
      const translatedQuery = `超級${convertSCtoTC(base)}${suffix}`;
      const exactMega = pokemonList.find(p => p.nameZh === translatedQuery || normalizeZh(p.nameZh || '') === normalizeZh(translatedQuery));
      if (exactMega) return { match: exactMega, originalQuery: query, resolvedName: exactMega.nameZh || exactMega.nameEn, isFuzzy: true };
    }

    // 3. Fuzzy matching Chinese
    let bestMatch: any = null, maxSim = 0.0;
    for (const p of pokemonList) {
      if (!p.nameZh) continue;
      const sim = getSimilarity(tcQuery, normalizeZh(p.nameZh));
      if (sim > maxSim) { maxSim = sim; bestMatch = p; }
    }
    if (bestMatch && maxSim >= 0.70) {
      return { match: bestMatch, originalQuery: query, resolvedName: bestMatch.nameZh || bestMatch.nameEn, isFuzzy: true };
    }
  } else {
    const normQuery = normalize(query);
    
    // Handle standard English Megas
    const megaMatch = normQuery.match(/^([a-z]+)mega([xy])?$/);
    let searchNorm = normQuery;
    if (megaMatch) {
      searchNorm = `mega${megaMatch[1]}${megaMatch[2] || ''}`;
    }

    const findExact = (norm: string) =>
      pokemonList.find(p => normalize(p.nameEn) === norm || normalize(p.identifier) === norm);

    const exact = findExact(searchNorm);
    if (exact) return { match: exact, originalQuery: query, resolvedName: exact.nameEn, isFuzzy: false };

    // Gendered species are spelled `Meowstic-F` / `Meowstic-M` by Showdown, and the
    // male (default) form just `Meowstic`; the dex spells them `Meowstic (Female)` /
    // `(Male)`. Levenshtein can't bridge that — every one of these scores under the
    // 0.75 threshold, and `-F` scores *below* the male row — so expand the suffix and
    // retry the exact match. Alias expansion only: it can never land on another species.
    const genderNorm = searchNorm.endsWith('f') ? `${searchNorm.slice(0, -1)}female`
      : searchNorm.endsWith('m') ? `${searchNorm.slice(0, -1)}male`
      : `${searchNorm}male`;
    const gendered = findExact(genderNorm);
    if (gendered) return { match: gendered, originalQuery: query, resolvedName: gendered.nameEn, isFuzzy: true };

    // Fuzzy matching English
    let bestMatch: any = null, maxSim = 0.0;
    for (const p of pokemonList) {
      const nameEnSim = getSimilarity(normQuery, normalize(p.nameEn));
      const identSim = p.identifier ? getSimilarity(normQuery, normalize(p.identifier)) : 0;
      const sim = Math.max(nameEnSim, identSim);
      if (sim > maxSim) { maxSim = sim; bestMatch = p; }
    }
    if (bestMatch && maxSim >= 0.75) {
      return { match: bestMatch, originalQuery: query, resolvedName: bestMatch.nameEn, isFuzzy: true };
    }
  }
  return null;
}

export function matchMove(query: string, moveList: any[]): MatchResult<any> | null {
  if (!query) return null;
  const isChinese = /[\u4e00-\u9fa5]/.test(query);

  if (isChinese) {
    const tcQuery = normalizeZh(query);
    const exact = moveList.find(m => m.nameZh && normalizeZh(m.nameZh) === tcQuery);
    if (exact) return { match: exact, originalQuery: query, resolvedName: exact.nameZh || exact.nameEn, isFuzzy: false };

    let bestMatch: any = null, maxSim = 0.0;
    for (const m of moveList) {
      if (!m.nameZh) continue;
      const sim = getSimilarity(tcQuery, normalizeZh(m.nameZh));
      if (sim > maxSim) { maxSim = sim; bestMatch = m; }
    }
    if (bestMatch && maxSim >= 0.70) {
      return { match: bestMatch, originalQuery: query, resolvedName: bestMatch.nameZh || bestMatch.nameEn, isFuzzy: true };
    }
  } else {
    const normQuery = normalize(query);
    const exact = moveList.find(m => normalize(m.nameEn) === normQuery);
    if (exact) return { match: exact, originalQuery: query, resolvedName: exact.nameEn, isFuzzy: false };

    let bestMatch: any = null, maxSim = 0.0;
    for (const m of moveList) {
      const sim = getSimilarity(normQuery, normalize(m.nameEn));
      if (sim > maxSim) { maxSim = sim; bestMatch = m; }
    }
    if (bestMatch && maxSim >= 0.75) {
      return { match: bestMatch, originalQuery: query, resolvedName: bestMatch.nameEn, isFuzzy: true };
    }
  }
  return null;
}

export function matchAbility(query: string, abilityNames: string[]): MatchResult<string> | null {
  if (!query) return null;
  const isChinese = /[\u4e00-\u9fa5]/.test(query);
  const tcQuery = isChinese ? normalizeZh(query) : normalize(query);

  const exact = abilityNames.find(a => (isChinese ? normalizeZh(a) : normalize(a)) === tcQuery);
  if (exact) return { match: exact, originalQuery: query, resolvedName: exact, isFuzzy: false };

  let bestMatch: string | null = null, maxSim = 0.0;
  for (const a of abilityNames) {
    const sim = getSimilarity(tcQuery, isChinese ? normalizeZh(a) : normalize(a));
    if (sim > maxSim) { maxSim = sim; bestMatch = a; }
  }
  const thresh = isChinese ? 0.70 : 0.75;
  if (bestMatch && maxSim >= thresh) {
    return { match: bestMatch, originalQuery: query, resolvedName: bestMatch, isFuzzy: true };
  }
  return null;
}

const allItems = Array.from(Generations.get(9).items).map(item => item.name);

export function matchItem(query: string): MatchResult<string> | null {
  if (!query) return null;
  if (query.toLowerCase() === 'none' || query.toLowerCase() === '(no item)') {
    return { match: query, originalQuery: query, resolvedName: query, isFuzzy: false };
  }
  const isChinese = /[\u4e00-\u9fa5]/.test(query);
  
  if (isChinese) {
    const tcQuery = convertSCtoTC(query);
    const normTcQuery = normalizeZh(tcQuery);
    
    let resolvedEnglishName = CHINESE_TO_ENGLISH_ITEMS[tcQuery];
    if (!resolvedEnglishName) {
      for (const [zhKey, enName] of Object.entries(CHINESE_TO_ENGLISH_ITEMS)) {
        if (normalizeZh(zhKey) === normTcQuery) {
          resolvedEnglishName = enName;
          break;
        }
      }
    }
    
    if (resolvedEnglishName) {
      const exact = allItems.find(item => normalize(item) === normalize(resolvedEnglishName));
      if (exact) {
        return { match: exact, originalQuery: query, resolvedName: exact, isFuzzy: false };
      }
    }
    
    // Check English allItems list as a fallback
    const normQuery = normalize(query);
    const exact = allItems.find(item => normalize(item) === normQuery);
    if (exact) return { match: exact, originalQuery: query, resolvedName: exact, isFuzzy: false };

    let bestMatch: string | null = null, maxSim = 0.0;
    for (const item of allItems) {
      const sim = getSimilarity(normQuery, normalize(item));
      if (sim > maxSim) { maxSim = sim; bestMatch = item; }
    }
    if (bestMatch && maxSim >= 0.75) {
      return { match: bestMatch, originalQuery: query, resolvedName: bestMatch, isFuzzy: true };
    }

    return null;
  }
  
  const normQuery = normalize(query);
  const exact = allItems.find(item => normalize(item) === normQuery);
  if (exact) return { match: exact, originalQuery: query, resolvedName: exact, isFuzzy: false };

  let bestMatch: string | null = null, maxSim = 0.0;
  for (const item of allItems) {
    const sim = getSimilarity(normQuery, normalize(item));
    if (sim > maxSim) { maxSim = sim; bestMatch = item; }
  }
  if (bestMatch && maxSim >= 0.75) {
    return { match: bestMatch, originalQuery: query, resolvedName: bestMatch, isFuzzy: true };
  }
  return null;
}
