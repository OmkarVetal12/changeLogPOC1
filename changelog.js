const { execSync } = require('child_process');
const fs = require('fs');

// Configuration
const config = {
  outputFile: 'CHANGELOG.md',
  types: {
    feat: 'Features',
    fix: 'Bug Fixes',
    docs: 'Documentation',
    style: 'Styles',
    refactor: 'Code Refactoring',
    perf: 'Performance',
    test: 'Tests',
    build: 'Build System',
    ci: 'CI',
    chore: 'Chores'
  },
  breakingChangeIndicator: '!',
  excludeTypes: ['chore', 'ci'],
  dateFormat: { year: 'numeric', month: 'long', day: 'numeric' }
};

function getLatestTag() {
  try {
    return execSync('git describe --tags --abbrev=0').toString().trim();
  } catch {
    return null;
  }
}

function getCommits(since) {
  const command = since
    ? `git log ${since}..HEAD --pretty=format:"%h|%s|%b|%aI"`
    : 'git log --pretty=format:"%h|%s|%b|%aI"';
  
  return execSync(command)
    .toString()
    .split('\n')
    .filter(Boolean);
}

function parseCommit(commitStr) {
  const [hash, subject, body, date] = commitStr.split('|');
  const typeMatch = subject.match(/^([a-z]+)(\(!?\))?:/);
  
  if (!typeMatch) return null;
  
  const [, type] = typeMatch;
  if (config.excludeTypes.includes(type)) return null;
  
  const message = subject.slice(subject.indexOf(':') + 1).trim();
  const isBreaking = subject.includes(config.breakingChangeIndicator);
  
  return {
    hash,
    type,
    message,
    body,
    date: new Date(date),
    isBreaking
  };
}

function groupCommits(commits) {
  const groups = {};
  const breaking = [];
  
  commits.forEach(commit => {
    if (!commit) return;
    
    if (commit.isBreaking) {
      breaking.push(commit);
    }
    
    const type = config.types[commit.type] || commit.type;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(commit);
  });
  
  return { groups, breaking };
}

function generateMarkdown(groups, breaking, version) {
  const date = new Date().toLocaleDateString('en-US', config.dateFormat);
  let markdown = `## [${version}] - ${date}\n\n`;
  
  if (breaking.length) {
    markdown += '### ⚠ BREAKING CHANGES\n\n';
    breaking.forEach(commit => {
      markdown += `- ${commit.message} ([${commit.hash}])\n`;
    });
    markdown += '\n';
  }
  
  Object.entries(groups).forEach(([type, commits]) => {
    if (commits.length) {
      markdown += `### ${type}\n\n`;
      commits.forEach(commit => {
        markdown += `- ${commit.message} ([${commit.hash}])\n`;
      });
      markdown += '\n';
    }
  });
  
  return markdown;
}

function generateChangelog(newVersion) {
  const latestTag = getLatestTag();
  const commits = getCommits(latestTag);
  const parsedCommits = commits.map(parseCommit);
  const { groups, breaking } = groupCommits(parsedCommits);
  const markdown = generateMarkdown(groups, breaking, newVersion);
  
  const existingContent = fs.existsSync(config.outputFile)
    ? fs.readFileSync(config.outputFile, 'utf8')
    : '# Changelog\n\n';
  
  fs.writeFileSync(
    config.outputFile,
    existingContent.replace('# Changelog\n\n', `# Changelog\n\n${markdown}`)
  );
  
  console.log(`Changelog generated for version ${newVersion}`);
}

// Usage
if (require.main === module) {
  const version = process.argv[2];
  if (!version) {
    console.error('Please provide a version number');
    process.exit(1);
  }
  generateChangelog(version);
}

module.exports = { generateChangelog };