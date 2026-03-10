const core = require('@actions/core');
const github = require('@actions/github');
const { TipBot } = require('./tip-bot');

async function run() {
  try {
    // Get inputs
    const token = core.getInput('github-token', { required: true });
    const rustchainApiUrl = core.getInput('rustchain-api-url', { required: true });
    const rustchainApiKey = core.getInput('rustchain-api-key', { required: true });

    // Create Octokit client
    const octokit = github.getOctokit(token);

    // Get context
    const context = github.context;
    const { eventName, payload } = context;

    // Only process issue_comment events
    if (eventName !== 'issue_comment') {
      core.info(`Event ${eventName} is not supported. Skipping.`);
      return;
    }

    // Only process created comments (not edits)
    if (payload.action !== 'created') {
      core.info(`Comment action ${payload.action} is not supported. Skipping.`);
      return;
    }

    const comment = payload.comment;
    const commentBody = comment.body;
    const commenter = comment.user.login;
    const issueNumber = payload.issue.number;
    const repo = context.repo;

    core.info(`Processing comment from @${commenter}: ${commentBody.substring(0, 100)}...`);

    // Initialize TipBot
    const tipBot = new TipBot({
      octokit,
      rustchainApiUrl,
      rustchainApiKey,
      repo,
      issueNumber
    });

    // Process the comment
    await tipBot.processComment(commentBody, commenter, comment.html_url);

  } catch (error) {
    core.setFailed(`Action failed: ${error.message}`);
  }
}

run();
