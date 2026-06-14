require("dotenv").config();
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const { HLTV: HLTVClass } = require("hltv");
const config = require("./config.json");

let gotScraping;

// This initializes HLTV and dynamic loads the stealth library safely
const HLTV = HLTVClass.createInstance({
    loadPage: async (url) => {
        // Safely load the module regardless of the project format
        if (!gotScraping) {
            const module = await import("got-scraping");
            gotScraping = module.gotScraping;
        }
        
        const response = await gotScraping({
            url: url,
            headerGeneratorOptions: {
                browsers: [{ name: 'chrome', minVersion: 120 }],
                devices: ['desktop'],
                operatingSystems: ['windows', 'macos']
            }
        });
        return response.body;
    }
});

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

let postedMatches = [];
let postedNews = [];

client.once("ready", () => {
    console.log(`${client.user.tag} is online and bypasses Cloudflare!`);

    checkMatches();
    checkNews();
    checkRankings();

    setInterval(checkMatches, 300000);   // Check matches every 5 minutes
    setInterval(checkNews, 600000);      // Check news every 10 minutes
    setInterval(checkRankings, 86400000);  // Check rankings once a day
});

// 1. MATCH POSTER (WITH FIXED PROTECTION AND EVENT FALLBACKS)
async function checkMatches() {
    try {
        const channel = await client.channels.fetch(config.matchesChannel);
        const matches = await HLTV.getMatches();

        for (const match of matches) {
            if (postedMatches.includes(match.id)) continue;
            postedMatches.push(match.id);

            // Safer variables in case HLTV returns null properties for TBD events/times
            const eventName = match.event?.name ?? "Event TBD";
            const matchTime = match.date ? new Date(match.date).toUTCString() : "Time TBD";

            const embed = new EmbedBuilder()
                .setColor("#e11d48")
                .setTitle("🔥 Upcoming Match")
                .setDescription(`${match.team1?.name ?? "TBD"} vs ${match.team2?.name ?? "TBD"}\n\n🏆 ${eventName}\n\n🕒 ${matchTime}`)
                .setURL(`https://www.hltv.org/matches/${match.id}`)
                .setFooter({ text: "CS Watch" })
                .setTimestamp();

            channel.send({ embeds: [embed] });
        }
    } catch (err) { console.error("Match error:", err.message); }
}

// 2. NEWS POSTER
async function checkNews() {
    try {
        const channel = await client.channels.fetch(config.newsChannel);
        const news = await HLTV.getNews();

        for (const article of news.slice(0, 3)) {
            const articleId = article.link.split("/")[2];
            if (postedNews.includes(articleId)) continue;
            postedNews.push(articleId);

            const embed = new EmbedBuilder()
                .setColor("#f59e0b")
                .setTitle(`📰 Breaking News: ${article.title}`)
                .setDescription(`Latest update from the CS competitive scene.`)
                .setURL(`https://www.hltv.org${article.link}`)
                .setFooter({ text: "CS Watch News" })
                .setTimestamp();

            channel.send({ embeds: [embed] });
        }
    } catch (err) { console.error("News error:", err.message); }
}

// 3. RANKINGS POSTER
async function checkRankings() {
    try {
        const channel = await client.channels.fetch(config.rankingsChannel);
        const rankings = await HLTV.getTeamRanking();
        
        const topTeams = rankings.slice(0, 10);
        let rankingList = "";
        topTeams.forEach((team, index) => {
            rankingList += `**#${index + 1}** ${team.team.name} _(${team.points} pts)_\n`;
        });

        const embed = new EmbedBuilder()
            .setColor("#3b82f6")
            .setTitle("📊 Current HLTV World Rankings")
            .setDescription(rankingList)
            .setFooter({ text: "CS Watch Rankings" })
            .setTimestamp();

        channel.send({ embeds: [embed] });
    } catch (err) { console.error("Rankings error:", err.message); }
}

client.login(process.env.TOKEN);