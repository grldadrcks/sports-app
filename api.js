const BASE_URL = "https://site.api.espn.com/apis/site/v2/sports";

const SOCCER_LEAGUES = {
  "Premier League": "soccer/eng.1",
  "La Liga": "soccer/esp.1",
  Bundesliga: "soccer/ger.1",
  "Serie A": "soccer/ita.1",
  "Ligue 1": "soccer/fra.1",
  "Champions Lge": "soccer/uefa.champions_league",
  "Europa League": "soccer/uefa.europa",
  MLS: "soccer/usa.1",
  Eredivisie: "soccer/ned.1",
  "Liga Portugal": "soccer/por.1",
  "A-League": "soccer/aus.1",
  "Copa America": "soccer/conmebol.america",
  "World Cup": "soccer/fifa.world",
  "Argentine Liga": "soccer/arg.1",
};

const BASKETBALL_LEAGUES = {
  NBA: "basketball/nba",
  WNBA: "basketball/wnba",
  EuroLeague: "basketball/euroleague",
};

function parseGame(event, league, sport) {
  try {
    const comp = event.competitions[0];
    const competitors = comp.competitors;
    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");
    if (!home || !away) return null;

    const status = event.status;
    const stype = status.type.name;
    const clock = status.displayClock || "";
    const period = status.period || 0;

    let periodInfo = "";
    if (stype === "STATUS_IN_PROGRESS") {
      if (sport === "soccer") {
        periodInfo = `${clock}'`;
      } else if (period > 4) {
        periodInfo = `OT${period - 4}  ${clock}`;
      } else {
        periodInfo = `Q${period}  ${clock}`;
      }
    }

    return {
      id: event.id,
      league,
      sport,
      homeTeam: home.team.shortDisplayName || home.team.displayName,
      awayTeam: away.team.shortDisplayName || away.team.displayName,
      homeScore: String(home.score ?? "-"),
      awayScore: String(away.score ?? "-"),
      statusType: stype,
      periodInfo,
      date: event.date || "",
    };
  } catch {
    return null;
  }
}

async function fetchLeague(league, path, sport, date) {
  const url = `${BASE_URL}/${path}/scoreboard`;
  const params = date
    ? `?dates=${date.toISOString().slice(0, 10).replace(/-/g, "")}`
    : "";
  try {
    const resp = await fetch(`${url}${params}`, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.events || [])
      .map((e) => parseGame(e, league, sport))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function leagueMap(sportFilter) {
  const leagues = {};
  if (sportFilter === "all" || sportFilter === "soccer") {
    Object.entries(SOCCER_LEAGUES).forEach(([name, path]) => {
      leagues[name] = { path, sport: "soccer" };
    });
  }
  if (sportFilter === "all" || sportFilter === "basketball") {
    Object.entries(BASKETBALL_LEAGUES).forEach(([name, path]) => {
      leagues[name] = { path, sport: "basketball" };
    });
  }
  return leagues;
}

async function fetchScores(sportFilter = "all", date = null) {
  const leagues = leagueMap(sportFilter);
  const promises = Object.entries(leagues).map(([name, { path, sport }]) =>
    fetchLeague(name, path, sport, date)
  );
  const results = await Promise.allSettled(promises);
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

export async function getTodayScores(sportFilter = "all") {
  const games = await fetchScores(sportFilter);
  const live = games.filter((g) => g.statusType === "STATUS_IN_PROGRESS");
  const scheduled = games.filter((g) => g.statusType === "STATUS_SCHEDULED");
  const final = games.filter((g) => g.statusType === "STATUS_FINAL");
  return [...live, ...scheduled, ...final];
}

export async function getUpcomingGames(sportFilter = "all", days = 3) {
  const upcoming = [];
  for (let i = 1; i <= days; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const games = await fetchScores(sportFilter, date);
    upcoming.push(...games.filter((g) => g.statusType === "STATUS_SCHEDULED"));
  }
  return upcoming;
}
