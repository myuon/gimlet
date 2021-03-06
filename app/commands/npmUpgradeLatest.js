const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const command = (commands, cwd) => {
  const output = execSync(commands.join(" "), { cwd });
  return {
    stdout: output.toString().trim(),
  };
};
const commandWithStatus = (commands, cwd) => {
  try {
    return command(commands, cwd);
  } catch (error) {
    return {
      status: error.status,
    };
  }
};

// prepare workdir
const workDir = path.join(__dirname, "../../workdir");
command(["mkdir", "-p", workDir]);

const npmUpgradeLatest = async (
  { packageName, repositoryName, repositoryPath },
  sendEvent
) => {
  const repoDir = path.join(workDir, repositoryName);
  const progressSum = 6;
  let progressCounter = 0;

  sendEvent({
    message: `Started`,
    progress: progressCounter++ / progressSum,
    type: "start",
  });

  const defaultBranchName = command(
    ["git rev-parse --abbrev-ref origin/HEAD | cut -d '/' -f 2"],
    repoDir
  )
    .stdout.toString()
    .trim();

  // clone a repository OR switch to default branch
  if (fs.existsSync(repoDir)) {
    sendEvent({
      message: `Syncing ${repositoryName}...`,
      progress: progressCounter++ / progressSum,
      type: "message",
    });

    // This only works for a repository cloned from origin
    command(["git", "checkout", branch], repoDir);
    console.log(`[npm:upgradeLatest] switched to branch ${defaultBranchName}`);
    command(["git", "fetch"], repoDir);
    console.log(`[npm:upgradeLatest] git fetch executed`);
  } else {
    sendEvent({
      message: `Cloning ${repositoryName}...`,
      progress: progressCounter++ / progressSum,
      type: "message",
    });

    command(["git", "clone", repositoryPath], workDir);
    console.log(`[npm:upgradeLatest] cloned ${repositoryName}`);
  }

  // switch to working branch
  const branchName = `gimlet/upgrade-latest/${packageName}-${Math.floor(
    new Date().getTime() / 1000
  )}`;
  command(["git", "checkout", "-b", branchName], repoDir);

  // install dependencies
  sendEvent({
    message: `Installing dependencies...`,
    progress: progressCounter++ / progressSum,
    type: "message",
  });

  if (fs.existsSync(path.join(repoDir, "package-lock.json"))) {
    console.log(`[npm:upgradeLatest] npm ci`);
    console.log(command(["npm", "ci"], repoDir).stdout.toString().trim());

    sendEvent({
      message: `Updating...`,
      progress: progressCounter++ / progressSum,
      type: "message",
    });

    console.log(`[npm:upgradeLatest] npm update ${packageName}`);
    console.log(
      command(["npm", "update", packageName], repoDir).stdout.toString().trim()
    );
  } else if (fs.existsSync(path.join(repoDir, "yarn.lock"))) {
    console.log(`[npm:upgradeLatest] yarn install`);
    console.log(command(["yarn", "install"], repoDir).stdout.toString().trim());

    sendEvent({
      message: `Updating...`,
      progress: progressCounter++ / progressSum,
      type: "message",
    });

    console.log(`[npm:upgradeLatest] yarn upgrade ${packageName} --latest`);
    console.log(
      command(["yarn", "upgrade", packageName, "--latest"], repoDir)
        .stdout.toString()
        .trim()
    );
  } else {
    console.log(
      `[npm:upgradeLatest] package-lock.json nor yarn.lock found. Abort.`
    );
    return;
  }

  // check if there is a change
  console.log(commandWithStatus(["git diff --exit-code"]).status);
  if (commandWithStatus(["git diff --exit-code"]).status === 0) {
    console.log(
      `[npm:upgradeLatest] package ${packageName} is already up-to-date`
    );
    return;
  }

  sendEvent({
    message: `Pushing to remote repository...`,
    progress: progressCounter++ / progressSum,
    type: "message",
  });

  // commit and push
  command(["git", "add", "."], repoDir);
  console.log(
    `[npm:upgradeLatest] committed: ${command(
      ["git", "commit", "-m", `"Upgrade ${packageName} to latest"`],
      repoDir
    ).stdout.toString()}`
  );
  console.log(
    `[npm:upgradeLatest] pushed: ${command(
      ["git", "push", "origin", branchName],
      repoDir
    ).stdout.toString()}`
  );

  sendEvent({
    message: `Done!`,
    progress: progressCounter++ / progressSum,
    type: "done",
    branchName,
    defaultBranchName,
  });
};

module.exports = { npmUpgradeLatest };
