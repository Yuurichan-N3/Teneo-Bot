const WebSocket = require("ws");
const fs = require("fs/promises");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { SocksProxyAgent } = require("socks-proxy-agent");
const readline = require("readline");
const chalk = require("chalk");
const colors = require("colors");
const axios = require("axios");
const cliProgress = require("cli-progress");
const Table = require("cli-table3");
const { config } = require("./config");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

// Format log levels with colors
function formatLevel(level) {
  switch(level) {
    case 'error': return chalk.red.bold(`[ERROR]`);
    case 'warn': return chalk.yellow.bold(`[WARN]`);
    case 'info': return chalk.blue.bold(`[INFO]`);
    case 'success': return chalk.green.bold(`[SUCCESS]`);
    default: return chalk.white(`[${level.toUpperCase()}]`);
  }
}

// Custom progress bar formats
const progressBarFormat = {
  format: `${chalk.cyan('{bar}')} | ${chalk.yellow('{percentage}%')} | ${chalk.green('ETA: {eta}s')} | {value}/{total}`,
  barCompleteChar: '█',
  barIncompleteChar: '░',
  hideCursor: true
};

// Banner display function
function displayBanner() {
  console.log(chalk.bold.hex('#FF5733')('╔══════════════════════════════════════════════╗'));
  console.log(chalk.bold.hex('#FF5733')('║      🚀 TENEO BOT - Auto Task Completion     ║'));
  console.log(chalk.bold.hex('#FF5733')('║    Automate your Teneo account tasks!        ║'));
  console.log(chalk.bold.hex('#FF5733')('║  Developed by: https://t.me/sentineldiscus   ║'));
  console.log(chalk.bold.hex('#FF5733')('╚══════════════════════════════════════════════╝'));
}

// Headers for API requests
function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
    Accept: "*/*",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "Accept-Language": "vi,en-US;q=0.9,en;q=0.8",
    Referer: "https://dashboard.teneo.pro/",
    Origin: "https://dashboard.teneo.pro",
    "Sec-Ch-Ua": '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "x-api-key": config.X_API_KEY,
  };
}

// Proxy agent setup
function getProxyAgent(proxyUrl) {
  try {
    const isSocks = proxyUrl.toLowerCase().startsWith("socks");
    if (isSocks) {
      return new SocksProxyAgent(proxyUrl);
    }
    return new HttpsProxyAgent(proxyUrl);
  } catch (error) {
    console.warn(`Failed to create proxy ${proxyUrl}: ${error.message}`);
    return null;
  }
}

// Read file with progress bar
async function readFile(filePath) {
  try {
    const data = await fs.readFile(filePath, "utf-8");
    const lines = data.split("\n");
    const tokens = [];
    
    const progressBar = new cliProgress.SingleBar(progressBarFormat, cliProgress.Presets.shades_classic);
    progressBar.start(lines.length, 0);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        tokens.push(line);
      }
      progressBar.update(i + 1);
      // Add a small delay to make the progress bar visible
      await new Promise(resolve => setTimeout(resolve, 10)); 
    }
    
    progressBar.stop();
    return tokens;
  } catch (error) {
    console.error("Error reading file:", error.message);
    return [];
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

class WebSocketClient {
  constructor(token, proxy = null, accountIndex, proxyIP) {
    this.token = token;
    this.proxy = proxy;
    this.proxyIp = proxyIP;
    this.accountIndex = accountIndex;

    this.socket = null;
    this.pingInterval = null;
    this.reconnectAttempts = 0;
    this.wsUrl = "wss://secure.ws.teneo.pro";
    this.version = "v0.2";
    this.stats = {
      messagesReceived: 0,
      totalPoints: 0,
      reconnections: 0,
      lastMessageTime: null
    };
  }

  getAccountPrefix() {
    return chalk.bgGreen.black(` A${this.accountIndex + 1} `) + 
           (this.proxyIp ? chalk.bgBlue.white(` ${this.proxyIp} `) : '');
  }

  log(msg, type = "info") {
    const prefix = this.getAccountPrefix();
    switch (type) {
      case "success":
        console.log(`${prefix} ${chalk.green(msg)}`);
        break;
      case "error":
        console.error(`${prefix} ${chalk.red(msg)}`);
        break;
      case "warning":
        console.warn(`${prefix} ${chalk.yellow(msg)}`);
        break;
      case "info":
        console.info(`${prefix} ${chalk.blue(msg)}`);
        break;
      case "custom":
        console.log(`${prefix} ${chalk.magenta(msg)}`);
        break;
      default:
        console.log(`${prefix} ${msg}`);
    }
  }

  async connect() {
    const wsUrl = `${this.wsUrl}/websocket?accessToken=${encodeURIComponent(this.token)}&version=${encodeURIComponent(this.version)}`;

    const options = {
      headers: {
        host: "secure.ws.teneo.pro",
        origin: "chrome-extension://emcclcoaglgcpoognfiggmhnhgabppkm",
        "sec-websocket-key": "xnAxNdgZWvXPwX11xOmTDQ==",
        "sec-websocket-extensions": "permessage-deflate; client_max_window_bits",
      },
    };
    
    if (this.proxy) {
      options.agent = getProxyAgent(this.proxy);
    }

    this.socket = new WebSocket(wsUrl, options);

    this.socket.onopen = () => {
      const connectionTime = new Date().toISOString();
      this.log(`WebSocket connected at ${connectionTime}`, "success");
      this.reconnectAttempts = 0;
      this.startPinging();
    };

    this.socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.stats.messagesReceived++;
      this.stats.totalPoints = data?.pointsTotal || this.stats.totalPoints;
      this.stats.lastMessageTime = new Date().toLocaleString();
      
      const message = `Message: ${chalk.yellow(data?.message || 'No message')} | Points: ${chalk.green(data?.pointsTotal || 0)} | Waiting ${chalk.cyan('15 minutes')} to next ping...`;
      this.log(message, "success");
    };

    this.socket.onclose = () => {
      this.log("WebSocket disconnected", "warning");
      this.stats.reconnections++;
      this.stopPinging();
      this.reconnect();
    };

    this.socket.onerror = (error) => {
      this.log(`WebSocket error: ${error.message}`, "error");
    };
  }

  reconnect() {
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
    this.log(`Reconnecting in ${chalk.yellow(delay / 1000)} seconds...`, "warning");
    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.stopPinging();
    }
  }

  startPinging() {
    this.stopPinging();
    this.pingInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: "PING" }));
        this.log("Sent ping to server", "info");
      }
    }, 10000);
  }

  stopPinging() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
  
  getStatsSummary() {
    return {
      account: this.accountIndex + 1,
      proxy: this.proxyIp || "None",
      messagesReceived: this.stats.messagesReceived,
      points: this.stats.totalPoints,
      reconnections: this.stats.reconnections,
      lastActivity: this.stats.lastMessageTime || "Never"
    };
  }
}

async function checkProxyIP(proxy, index, total) {
  const progressBar = new cliProgress.SingleBar({
    ...progressBarFormat,
    format: `${chalk.cyan('{bar}')} | ${chalk.yellow('{percentage}%')} | Checking proxy ${index}/${total}`
  }, cliProgress.Presets.shades_classic);
  
  progressBar.start(100, 0);
  
  try {
    progressBar.update(30);
    const proxyAgent = getProxyAgent(proxy);
    progressBar.update(60);
    const response = await axios.get("https://api.ipify.org?format=json", { 
      httpsAgent: proxyAgent, 
      timeout: 10000 
    });
    progressBar.update(100);
    progressBar.stop();
    
    if (response.status === 200) {
      console.info(`Proxy ${proxy} resolved to IP: ${chalk.green(response.data.ip)}`);
      return response.data.ip;
    }
    
    console.warn(`Proxy ${proxy} check failed with status: ${response.status}`);
    return null;
  } catch (error) {
    progressBar.stop();
    console.error(`Proxy ${proxy} check failed: ${error.message}`);
    return null;
  }
}

async function getRef(proxy, token) {
  const url = "https://api.teneo.pro/api/users/referrals?page=1&limit=25";
  let config = {
    headers: {
      ...headers(token),
    },
    timeout: 15000
  };
  
  if (proxy) {
    const agent = getProxyAgent(proxy);
    config = {
      ...config,
      httpsAgent: agent,
    };
  }

  try {
    const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    const spinnerInterval = setInterval(() => {
      process.stdout.write(`\r${chalk.yellow(spinner[i])} Fetching referral data...`);
      i = (i + 1) % spinner.length;
    }, 80);
    
    const response = await axios.get(url, config);
    clearInterval(spinnerInterval);
    process.stdout.write('\r' + ' '.repeat(50) + '\r');
    return response.data;
  } catch (error) {
    console.error("Error fetching referrals:", error.response ? error.response.data : error.message);
    return null;
  }
}

async function claimRef(proxy, ref, token) {
  const url = "https://api.teneo.pro/api/users/referrals/claim";
  let config = {
    headers: {
      ...headers(token),
    },
  };
  
  if (proxy) {
    const agent = getProxyAgent(proxy);
    config = {
      ...config,
      httpsAgent: agent,
    };
  }

  try {
    const response = await axios.post(
      url,
      {
        referralId: ref.id,
        all: false,
      },
      config
    );
    return response.data;
  } catch (error) {
    console.error("Error claiming referral:", error.response ? error.response.data : error.message);
    return null;
  }
}

async function handleRef(accountIndex, proxy, token) {
  console.info(`${chalk.cyan(`[Account ${accountIndex + 1}]`)} Checking referrals...`);
  
  const resInfo = await getRef(proxy, token);
  if (resInfo?.success) {
    const { unfiltered } = resInfo;
    
    // Create a table for referral stats
    const statsTable = new Table({
      head: [
        chalk.cyan('Ref Success'),
        chalk.cyan('Ref Pending'),
        chalk.cyan('Total Points')
      ],
      style: {
        head: [],
        border: []
      }
    });
    
    statsTable.push([
      chalk.green(unfiltered.stats.successfulReferralsAmount),
      chalk.yellow(unfiltered.stats.pendingReferralsAmount),
      chalk.blue(unfiltered.stats.totalReferralPoints)
    ]);
    
    console.log(`\n${chalk.cyan(`[Account ${accountIndex + 1}]`)} Referral Statistics:`);
    console.log(statsTable.toString());
    console.log(`${chalk.cyan(`[Account ${accountIndex + 1}]`)} Checking available rewards...`);
    
    const refClaims = unfiltered.referrals.filter((r) => r.canClaim);
    if (refClaims.length == 0) {
      console.warn(`${chalk.cyan(`[Account ${accountIndex + 1}]`)} No rewards available to claim`);
      return;
    }

    const claimProgressBar = new cliProgress.SingleBar({
      ...progressBarFormat,
      format: `${chalk.cyan('{bar}')} | ${chalk.yellow('{percentage}%')} | Claiming referrals: {value}/{total}`
    }, cliProgress.Presets.shades_classic);
    
    claimProgressBar.start(refClaims.length, 0);
    
    for (let i = 0; i < refClaims.length; i++) {
      const referral = refClaims[i];
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const resClaim = await claimRef(proxy, referral, token);
      
      if (resClaim?.success) {
        console.log(`${chalk.cyan(`[Account ${accountIndex + 1}]`)} Claimed referral: ${chalk.green(referral.id)}`);
      } else {
        console.warn(`${chalk.cyan(`[Account ${accountIndex + 1}]`)} Failed to claim referral: ${chalk.yellow(referral.id)}`);
      }
      
      claimProgressBar.update(i + 1);
    }
    
    claimProgressBar.stop();
  }
}

async function main() {
  try {
    displayBanner();
    console.info(chalk.cyan.bold("Starting Teneo WebSocket Client Enhanced Edition"));
    console.info(chalk.yellow("Loading configuration..."));
    
    console.log('\n' + chalk.bgMagenta.white(' ACCOUNT SETUP ') + '\n');
    
    console.info("Reading tokens from file...");
    const tokens = await readFile("data.txt");
    console.info(`Found ${chalk.green(tokens.length)} tokens`);
    
    rl.question(chalk.cyan("Do you want to use proxies? (y/n): "), async (useProxyAnswer) => {
      let useProxy = useProxyAnswer.toLowerCase() === "y";
      let proxies = [];

      if (useProxy) {
        console.info("Reading proxies from file...");
        proxies = await readFile("proxy.txt");
        console.info(`Found ${chalk.green(proxies.length)} proxies`);
      }

      if (tokens.length > 0) {
        const wsClients = [];
        console.log('\n' + chalk.bgGreen.black(' INITIALIZING CONNECTIONS ') + '\n');
        
        const proxyBar = new cliProgress.SingleBar({
          ...progressBarFormat,
          format: `${chalk.cyan('{bar}')} | ${chalk.yellow('{percentage}%')} | Setting up connections: {value}/{total}`
        }, cliProgress.Presets.shades_classic);
        
        proxyBar.start(tokens.length, 0);

        for (let i = 0; i < tokens.length; i++) {
          const token = tokens[i];
          const proxy = proxies[i] || null;
          let proxyIP = null;
          
          if (proxy) {
            try {
              proxyIP = await checkProxyIP(proxy, i+1, tokens.length);
              if (!proxyIP) {
                console.warn(`Proxy verification failed for ${proxy}... skipping account ${i+1}`);
                proxyBar.update(i + 1);
                continue;
              }
            } catch (error) {
              console.error(`Proxy check error for ${proxy}: ${error.message}... skipping account ${i+1}`);
              proxyBar.update(i + 1);
              continue;
            }
          }

          await handleRef(i, proxy, token);
          
          console.info(`Connecting WebSocket for ${chalk.green(`account ${i + 1}`)} - Proxy: ${proxy ? chalk.blue(proxy) : chalk.yellow('None')}`);

          const wsClient = new WebSocketClient(token, proxy, i, proxyIP || "Local");
          wsClient.connect();
          wsClients.push(wsClient);
          
          proxyBar.update(i + 1);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        
        proxyBar.stop();
        
        // Start status monitoring
        setInterval(() => {
          console.clear();
          displayBanner();
          
          const statsTable = new Table({
            head: [
              chalk.cyan('Account'),
              chalk.cyan('Proxy'),
              chalk.cyan('Messages'),
              chalk.cyan('Points'),
              chalk.cyan('Reconnects'),
              chalk.cyan('Last Activity')
            ],
            style: {
              head: [],
              border: []
            }
          });
          
          wsClients.forEach(client => {
            const stats = client.getStatsSummary();
            statsTable.push([
              chalk.green(`#${stats.account}`),
              stats.proxy === "Local" ? chalk.yellow(stats.proxy) : chalk.blue(stats.proxy),
              chalk.white(stats.messagesReceived),
              chalk.green(stats.points),
              chalk.yellow(stats.reconnections),
              chalk.cyan(stats.lastActivity)
            ]);
          });
          
          console.log(chalk.bold.underline("\nCurrent Status Report:"));
          console.log(statsTable.toString());
          
          console.log(`\n${chalk.gray('Last update:')} ${new Date().toLocaleString()}`);
          console.log(`${chalk.gray('Press')} ${chalk.bgRed.white(' CTRL+Z ')} ${chalk.gray('to exit')}\n`);
        }, 15000);

        process.on("SIGINT", () => {
          console.log("\n" + chalk.bgRed.white(' SHUTTING DOWN '));
          console.warn("Program terminated by user. Cleaning up connections...");
          
          const disconnectBar = new cliProgress.SingleBar({
            ...progressBarFormat,
            format: `${chalk.red('{bar}')} | ${chalk.yellow('{percentage}%')} | Disconnecting: {value}/{total}`
          }, cliProgress.Presets.shades_classic);
          
          disconnectBar.start(wsClients.length, 0);
          
          wsClients.forEach((client, index) => {
            client.stopPinging();
            client.disconnect();
            disconnectBar.update(index + 1);
          });
          
          disconnectBar.stop();
          console.log(chalk.green.bold("All connections closed successfully. Goodbye!"));
          process.exit(0);
        });
      } else {
        console.error("No tokens found in data.txt - exiting...");
        process.exit(0);
      }
    });
  } catch (error) {
    console.error("Critical error in main function:", error.stack);
    process.exit(1);
  }
}

main();
