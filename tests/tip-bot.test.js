const { TipBot } = require('../src/tip-bot');

// Mock dependencies
jest.mock('@actions/core');
jest.mock('@actions/github');
jest.mock('axios');

describe('TipBot', () => {
  let bot;
  let mockOctokit;

  beforeEach(() => {
    mockOctokit = {
      rest: {
        repos: {
          getCollaboratorPermissionLevel: jest.fn()
        },
        issues: {
          get: jest.fn(),
          createComment: jest.fn()
        }
      }
    };

    bot = new TipBot({
      octokit: mockOctokit,
      rustchainApiUrl: 'https://api.rustchain.io',
      rustchainApiKey: 'test-key',
      repo: { owner: 'test-owner', repo: 'test-repo' },
      issueNumber: 1
    });
  });

  describe('Command Parsing', () => {
    test('should parse /tip command correctly', async () => {
      mockOctokit.rest.repos.getCollaboratorPermissionLevel.mockResolvedValue({
        data: { permission: 'admin' }
      });

      // Register sender first
      await bot.handleRegister('sender', 'RTCsenderwalletaddress123456789012345678901234567890', '');
      // Register recipient
      await bot.handleRegister('recipient', 'RTCrecipientwalletaddress123456789012345678901234567890', '');

      const result = await bot.processComment(
        '/tip @recipient 5 RTC Great work!',
        'sender',
        'https://github.com/test/1'
      );

      expect(result).toBe(true);
    });

    test('should parse /balance command', async () => {
      await bot.handleRegister('user', 'RTCwalletaddress1234567890123456789012345678901234567890', '');
      
      const result = await bot.processComment(
        '/balance',
        'user',
        'https://github.com/test/1'
      );

      expect(result).toBe(true);
    });

    test('should parse /register command', async () => {
      const result = await bot.processComment(
        '/register RTCwalletaddress1234567890123456789012345678901234567890',
        'user',
        'https://github.com/test/1'
      );

      expect(result).toBe(true);
      expect(bot.userWallets.has('user')).toBe(true);
    });

    test('should parse /leaderboard command', async () => {
      const result = await bot.processComment(
        '/leaderboard',
        'user',
        'https://github.com/test/1'
      );

      expect(result).toBe(true);
    });
  });

  describe('Wallet Validation', () => {
    test('should accept valid wallet addresses', () => {
      expect(bot.isValidWalletAddress('RTCa95d28a468dd4ba76367483d338b13bcb20499bd')).toBe(true);
      expect(bot.isValidWalletAddress('RTC1d48d848a5aa5ecf2c5f01aa5fb64837daaf2f35')).toBe(true);
    });

    test('should reject invalid wallet addresses', () => {
      expect(bot.isValidWalletAddress('')).toBe(false);
      expect(bot.isValidWalletAddress('short')).toBe(false);
      expect(bot.isValidWalletAddress('invalid@address')).toBe(false);
      expect(bot.isValidWalletAddress('RTC short')).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    test('should allow tips within rate limit', () => {
      const result = bot.checkRateLimit('user');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    test('should block tips exceeding rate limit', () => {
      // Make 10 tips
      for (let i = 0; i < 10; i++) {
        bot.checkRateLimit('user');
      }
      
      const result = bot.checkRateLimit('user');
      expect(result.allowed).toBe(false);
      expect(result.error).toContain('Rate limit exceeded');
    });
  });

  describe('Permission Validation', () => {
    test('should allow admin users', async () => {
      mockOctokit.rest.repos.getCollaboratorPermissionLevel.mockResolvedValue({
        data: { permission: 'admin' }
      });

      const hasPermission = await bot.validateSenderPermission('admin-user');
      expect(hasPermission).toBe(true);
    });

    test('should allow write users', async () => {
      mockOctokit.rest.repos.getCollaboratorPermissionLevel.mockResolvedValue({
        data: { permission: 'write' }
      });

      const hasPermission = await bot.validateSenderPermission('write-user');
      expect(hasPermission).toBe(true);
    });

    test('should allow issue author', async () => {
      mockOctokit.rest.repos.getCollaboratorPermissionLevel.mockRejectedValue(new Error('Not found'));
      mockOctokit.rest.issues.get.mockResolvedValue({
        data: { user: { login: 'issue-author' } }
      });

      const hasPermission = await bot.validateSenderPermission('issue-author');
      expect(hasPermission).toBe(true);
    });

    test('should deny regular users', async () => {
      mockOctokit.rest.repos.getCollaboratorPermissionLevel.mockResolvedValue({
        data: { permission: 'read' }
      });
      mockOctokit.rest.issues.get.mockResolvedValue({
        data: { user: { login: 'someone-else' } }
      });

      const hasPermission = await bot.validateSenderPermission('regular-user');
      expect(hasPermission).toBe(false);
    });
  });
});
