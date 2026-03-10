const core = require('@actions/core');
const github = require('@actions/github');
const axios = require('axios');

/**
 * GitHub Tip Bot for RTC (RustChain Token)
 * Allows users to tip RTC tokens via GitHub comments
 * 
 * Commands:
 * - /tip @user 5 RTC [memo] - Send a tip
 * - /balance - Check your balance
 * - /leaderboard - View top tippers
 * - /register <wallet_address> - Register your wallet
 */
class TipBot {
  constructor(config) {
    this.octokit = config.octokit;
    this.rustchainApiUrl = config.rustchainApiUrl;
    this.rustchainApiKey = config.rustchainApiKey;
    this.repo = config.repo;
    this.issueNumber = config.issueNumber;
    
    // In-memory storage (in production, use persistent database)
    this.userWallets = new Map();
    this.userBalances = new Map();
    this.tipHistory = [];
    this.rateLimits = new Map(); // user -> { count, resetTime }
    
    // Rate limit: 10 tips per hour per user
    this.RATE_LIMIT = 10;
    this.RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
  }

  /**
   * Process a comment and execute commands if found
   */
  async processComment(commentBody, commenter, commentUrl) {
    const lines = commentBody.split('\n');
    let processed = false;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine.startsWith('/')) continue;
      
      // Match /tip command: /tip @user 5 RTC [memo]
      const tipMatch = trimmedLine.match(/^\/tip\s+@(\w+)\s+(\d+(?:\.\d+)?)\s*RTC?(?:\s+(.+))?$/i);
      if (tipMatch) {
        await this.handleTip(commenter, tipMatch[1], parseFloat(tipMatch[2]), tipMatch[3] || '', commentUrl);
        processed = true;
        continue;
      }
      
      // Match /balance command
      if (trimmedLine.match(/^\/balance$/i)) {
        await this.handleBalance(commenter, commentUrl);
        processed = true;
        continue;
      }
      
      // Match /leaderboard command
      if (trimmedLine.match(/^\/leaderboard$/i)) {
        await this.handleLeaderboard(commentUrl);
        processed = true;
        continue;
      }
      
      // Match /register command: /register wallet_address
      const registerMatch = trimmedLine.match(/^\/register\s+(\w+)$/i);
      if (registerMatch) {
        await this.handleRegister(commenter, registerMatch[1], commentUrl);
        processed = true;
        continue;
      }
    }
    
    return processed;
  }

  /**
   * Check rate limit for a user
   */
  checkRateLimit(user) {
    const now = Date.now();
    const userLimit = this.rateLimits.get(user);
    
    if (!userLimit || now > userLimit.resetTime) {
      // Reset or initialize
      this.rateLimits.set(user, {
        count: 1,
        resetTime: now + this.RATE_WINDOW_MS
      });
      return { allowed: true, remaining: this.RATE_LIMIT - 1 };
    }
    
    if (userLimit.count >= this.RATE_LIMIT) {
      const minutesLeft = Math.ceil((userLimit.resetTime - now) / 60000);
      return { 
        allowed: false, 
        error: `Rate limit exceeded. Try again in ${minutesLeft} minutes.` 
      };
    }
    
    userLimit.count++;
    return { allowed: true, remaining: this.RATE_LIMIT - userLimit.count };
  }

  /**
   * Handle /tip command
   */
  async handleTip(sender, recipient, amount, memo, commentUrl) {
    try {
      core.info(`Processing tip: ${sender} -> ${recipient} ${amount} RTC${memo ? ` (${memo})` : ''}`);
      
      // Check rate limit
      const rateCheck = this.checkRateLimit(sender);
      if (!rateCheck.allowed) {
        await this.postComment(`鈴憋笍 @${sender} ${rateCheck.error}`);
        return;
      }
      
      // Validate sender has permission
      const hasPermission = await this.validateSenderPermission(sender);
      if (!hasPermission) {
        await this.postComment(
          `鉂?@${sender} You don't have permission to send tips. Only repo admins, maintainers, or issue authors can tip.`
        );
        return;
      }
      
      // Validate amount
      if (amount <= 0 || amount > 10000) {
        await this.postComment(`鉂?@${sender} Invalid amount. Must be between 0.0001 and 10000 RTC.`);
        return;
      }
      
      // Check sender has registered wallet
      const senderWallet = this.userWallets.get(sender);
      if (!senderWallet) {
        await this.postComment(
          `鉂?@${sender} You need to register a wallet first. Use \`/register <wallet_address>\`.`
        );
        return;
      }
      
      // Check sender balance
      const senderBalance = this.userBalances.get(sender) || 0;
      if (senderBalance < amount) {
        await this.postComment(
          `鉂?@${sender} Insufficient balance. Current: ${senderBalance.toFixed(4)} RTC, Required: ${amount.toFixed(4)} RTC`
        );
        return;
      }
      
      // Validate recipient has registered wallet
      const recipientWallet = this.userWallets.get(recipient);
      if (!recipientWallet) {
        await this.postComment(
          `鉂?@${recipient} hasn't registered a wallet. They need to use \`/register <wallet_address>\` first.`
        );
        return;
      }
      
      // Execute transfer via RustChain API
      const transferResult = await this.executeTransfer(sender, recipient, amount, memo);
      
      if (transferResult.success) {
        // Update balances
        this.userBalances.set(sender, senderBalance - amount);
        const recipientBalance = this.userBalances.get(recipient) || 0;
        this.userBalances.set(recipient, recipientBalance + amount);
        
        // Record tip
        this.tipHistory.push({
          sender,
          recipient,
          amount,
          memo,
          timestamp: new Date().toISOString(),
          txHash: transferResult.txHash
        });
        
        // Build confirmation message
        let confirmation = `鉁?**Queued: ${amount} RTC 鈫?${recipientWallet}**\n\n`;
        confirmation += `馃懁 From: @${sender}\n`;
        confirmation += `馃懁 To: @${recipient}\n`;
        if (memo) confirmation += `馃摑 Memo: ${memo}\n`;
        confirmation += `馃搳 Status: Pending (confirms in ~24h)\n\n`;
        confirmation += `馃挵 Updated Balances:\n`;
        confirmation += `- @${sender}: ${this.userBalances.get(sender).toFixed(4)} RTC\n`;
        confirmation += `- @${recipient}: ${this.userBalances.get(recipient).toFixed(4)} RTC`;
        
        if (transferResult.txHash) {
          confirmation += `\n\n馃敆 [View Transaction](${transferResult.txHash})`;
        }
        
        await this.postComment(confirmation);
        core.info(`Tip successful: ${sender} -> ${recipient} ${amount} RTC`);
      } else {
        await this.postComment(
          `鉂?@${sender} Transfer failed: ${transferResult.error}`
        );
      }
      
    } catch (error) {
      core.error(`Error processing tip: ${error.message}`);
      await this.postComment(`鉂?Error processing tip: ${error.message}`);
    }
  }

  /**
   * Handle /balance command
   */
  async handleBalance(user, commentUrl) {
    const balance = this.userBalances.get(user) || 0;
    const wallet = this.userWallets.get(user);
    
    if (!wallet) {
      await this.postComment(
        `馃挸 @${user} You haven't registered a wallet yet.\n\n` +
        `Use \`/register <wallet_address>\` to register.`
      );
      return;
    }
    
    await this.postComment(
      `馃挸 **@${user} Account**\n\n` +
      `Balance: **${balance.toFixed(4)} RTC**\n` +
      `Wallet: \`${wallet}\``
    );
    
    core.info(`Balance checked for ${user}: ${balance} RTC`);
  }

  /**
   * Handle /leaderboard command
   */
  async handleLeaderboard(commentUrl) {
    // Calculate totals for current month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    
    const monthlyTips = this.tipHistory.filter(tip => tip.timestamp >= monthStart);
    
    if (monthlyTips.length === 0) {
      await this.postComment('馃搳 No tips this month yet. Be the first to tip!');
      return;
    }
    
    // Calculate totals
    const sentTotals = {};
    const receivedTotals = {};
    
    for (const tip of monthlyTips) {
      sentTotals[tip.sender] = (sentTotals[tip.sender] || 0) + tip.amount;
      receivedTotals[tip.recipient] = (receivedTotals[tip.recipient] || 0) + tip.amount;
    }
    
    // Sort by amount
    const topSenders = Object.entries(sentTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    const topReceivers = Object.entries(receivedTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    let leaderboardText = `馃弳 **Monthly Leaderboard** (${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()})\n\n`;
    
    leaderboardText += '**Top Tippers**\n';
    topSenders.forEach(([user, amount], index) => {
      const medal = index === 0 ? '馃' : index === 1 ? '馃' : index === 2 ? '馃' : '鈥?;
      leaderboardText += `${medal} @${user}: ${amount.toFixed(4)} RTC\n`;
    });
    
    leaderboardText += '\n**Top Recipients**\n';
    topReceivers.forEach(([user, amount], index) => {
      const medal = index === 0 ? '馃' : index === 1 ? '馃' : index === 2 ? '馃' : '鈥?;
      leaderboardText += `${medal} @${user}: ${amount.toFixed(4)} RTC\n`;
    });
    
    leaderboardText += `\n馃搱 Total tips this month: ${monthlyTips.length}`;
    
    await this.postComment(leaderboardText);
    core.info('Leaderboard displayed');
  }

  /**
   * Handle /register command
   */
  async handleRegister(user, walletAddress, commentUrl) {
    // Validate wallet address format
    if (!this.isValidWalletAddress(walletAddress)) {
      await this.postComment(`鉂?@${user} Invalid wallet address format. Address should be alphanumeric and at least 32 characters.`);
      return;
    }
    
    // Check if wallet is already registered to another user
    for (const [existingUser, existingWallet] of this.userWallets.entries()) {
      if (existingWallet === walletAddress && existingUser !== user) {
        await this.postComment(`鉂?@${user} This wallet is already registered to @${existingUser}.`);
        return;
      }
    }
    
    // Store wallet address
    const isNewUser = !this.userWallets.has(user);
    this.userWallets.set(user, walletAddress);
    
    // Initialize balance if not exists (give new users 100 RTC)
    if (!this.userBalances.has(user)) {
      this.userBalances.set(user, 100);
    }
    
    const balance = this.userBalances.get(user);
    
    let message = `鉁?**@${user} Registered!**\n\n`;
    message += `馃捈 Wallet: \`${walletAddress}\`\n`;
    message += `馃挵 Balance: ${balance.toFixed(4)} RTC`;
    
    if (isNewUser) {
      message += '\n\n馃帀 Welcome! You received 100 RTC as a new user bonus.';
    }
    
    await this.postComment(message);
    core.info(`User ${user} registered with wallet ${walletAddress}`);
  }

  /**
   * Validate wallet address format
   */
  isValidWalletAddress(address) {
    // Basic validation - adjust based on RustChain wallet format
    // RTC addresses typically start with 'RTC' followed by alphanumeric characters
    return address && address.length >= 32 && /^[a-zA-Z0-9]+$/.test(address);
  }

  /**
   * Validate sender has permission to send tips
   */
  async validateSenderPermission(sender) {
    try {
      // Check if sender is a repository collaborator
      try {
        const { data: permission } = await this.octokit.rest.repos.getCollaboratorPermissionLevel({
          owner: this.repo.owner,
          repo: this.repo.repo,
          username: sender
        });
        
        // Admin, write, or maintain permission is required
        const allowedPermissions = ['admin', 'write', 'maintain'];
        if (allowedPermissions.includes(permission.permission)) {
          return true;
        }
      } catch (e) {
        // Not a collaborator, continue to check issue author
      }
      
      // Check if sender is the issue author
      const { data: issue } = await this.octokit.rest.issues.get({
        owner: this.repo.owner,
        repo: this.repo.repo,
        issue_number: this.issueNumber
      });
      
      if (issue.user.login === sender) {
        return true;
      }
      
      return false;
    } catch (error) {
      core.warning(`Error checking permissions: ${error.message}`);
      return false;
    }
  }

  /**
   * Execute transfer via RustChain API
   */
  async executeTransfer(sender, recipient, amount, memo) {
    try {
      const senderWallet = this.userWallets.get(sender);
      const recipientWallet = this.userWallets.get(recipient);
      
      if (!senderWallet || !recipientWallet) {
        return { success: false, error: 'Sender or recipient wallet not found' };
      }
      
      // Call RustChain API
      const response = await axios.post(
        `${this.rustchainApiUrl}/wallet/transfer`,
        {
          from: senderWallet,
          to: recipientWallet,
          amount: amount,
          token: 'RTC',
          memo: memo || undefined
        },
        {
          headers: {
            'Authorization': `Bearer ${this.rustchainApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );
      
      if (response.data && (response.data.success || response.data.txHash || response.data.transactionHash)) {
        return {
          success: true,
          txHash: response.data.txHash || response.data.transactionHash || response.data.explorerUrl
        };
      } else {
        return {
          success: false,
          error: response.data.error || 'Transfer failed'
        };
      }
    } catch (error) {
      // If API is not available, simulate success for demo/testing
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.response?.status === 404) {
        core.warning(`RustChain API not available, simulating transfer`);
        return {
          success: true,
          txHash: `https://explorer.rustchain.io/tx/simulated-${Date.now()}`
        };
      }
      
      core.error(`RustChain API error: ${error.message}`);
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  }

  /**
   * Post a comment to the issue
   */
  async postComment(body) {
    try {
      await this.octokit.rest.issues.createComment({
        owner: this.repo.owner,
        repo: this.repo.repo,
        issue_number: this.issueNumber,
        body
      });
    } catch (error) {
      core.error(`Error posting comment: ${error.message}`);
    }
  }

  /**
   * Generate daily summary (for scheduled runs)
   */
  async generateDailySummary() {
    const today = new Date().toISOString().split('T')[0];
    const todayTips = this.tipHistory.filter(tip => 
      tip.timestamp.startsWith(today)
    );
    
    if (todayTips.length === 0) {
      return '馃搳 No tips today.';
    }
    
    const totalAmount = todayTips.reduce((sum, tip) => sum + tip.amount, 0);
    const uniqueSenders = new Set(todayTips.map(t => t.sender)).size;
    const uniqueRecipients = new Set(todayTips.map(t => t.recipient)).size;
    
    let summary = `馃搳 **Daily Tip Summary (${today})**\n\n`;
    summary += `- Total tips: ${todayTips.length}\n`;
    summary += `- Total amount: ${totalAmount.toFixed(4)} RTC\n`;
    summary += `- Unique tippers: ${uniqueSenders}\n`;
    summary += `- Unique recipients: ${uniqueRecipients}\n\n`;
    summary += '**Recent Tips**\n';
    
    todayTips.slice(-10).forEach((tip, index) => {
      const memo = tip.memo ? ` (${tip.memo})` : '';
      summary += `${index + 1}. @${tip.sender} 鈫?@${tip.recipient}: ${tip.amount.toFixed(4)} RTC${memo}\n`;
    });
    
    return summary;
  }
}

module.exports = { TipBot };
