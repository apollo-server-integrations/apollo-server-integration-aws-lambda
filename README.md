# TypeScript Template

This repo is meant to act as a reasonable foundation for a single NPM package developed in TypeScript. It makes use of a few tools that we've found particularly useful. Below are some notes on how to get started using these tools and ways in which you might want (or need) to configure them.

## GitHub

In the GitHub settings tab, we typically configure a few things.

**General**
✅ Automatically delete head branches

**Collaborators and Teams**
Add relevant teams and contributors with appropriate roles

**Branches**
Typically we add a branch protection rule for `main`
Generally, this rule enables:
* ✅ Require a pull request before merging
  * ✅ Require approvals (1)
* ✅ Require status checks to pass before merging
  * Each status check must be selected via the search box. Typing "ci/" will show you a list of the ones which exist within this template. "CLA" should also be enabled.

**Code Security and Analysis**
* Enable "Dependabot security updates" to receive security-related PRs from Dependabot

## CircleCI

This repo comes with a few Circle jobs already implemented (see [`.circleci/config.yml`](.circleci/config.yml)). Circle will run tests on the versions of Node specified in the matrix and enforce linting via Prettier.

In order to enable CircleCI on your new repo, visit the [Apollo org's dashboard](https://app.circleci.com/projects/project-dashboard/github/apollographql/) and add your project. If your repo has already been initialized and added to the apollographql org, you should see the option to add your new project.

## Jest

Jest is a testing framework used by most of Apollo's current projects.

To run tests in the repo:
`npm test`

The Jest configuration can be found at `jest.config.ts`. As configured, Jest will run all files named `*.test.ts` found within any `__tests__` folder. This is simply a convention chosen by this repo and can be reconfigured via the `testRegex` configuration option in [`jest.config.ts`](jest.config.ts).

For more information on configuring Jest see the [Jest docs](https://jestjs.io/docs/configuration).

## Changesets

Changesets is a tool for managing package versioning, NPM releases, GitHub releases, and CHANGELOG entries. In this template, it comes configured for all of the above.

### Basic usage

Changesets uses changeset files in the `.changeset` directory to determine what versioning upgrades need to happen next, along with related `CHANGELOG` updates and release notes. A changeset file is created by running `npx changeset` and following the prompts. PRs which make functional changes to the package should always come with an accompanying changeset file. The Changeset bot (details below) will comment on PRs as a reminder to contributors to include a changeset file when appropriate.

### Changeset bot

#### Installation

[GitHub app](https://github.com/apps/changeset-bot)
> Note: a GitHub _org_ admin must approve app installations. By adding a GitHub app to your repo, you'll be submitting a request for approval. At the time of writing this, the GitHub UI doesn't make this clear.

You might also be interested in adding `changeset-bot` to the repo - it leaves comments about the changeset (or lack thereof) for each PR. This serves as a nice reminder and set of instructions for how to create a changeset.
### CHANGELOG updates

For proper CHANGELOG management, you MUST configure the [`.changeset/config.json`](.changeset/config.json) file for your repo. The `changelog.repo` field must be the `<org>/<name>` of the repo.

### NPM Publishing

Changesets manages and updates a release PR automatically via a GitHub action [`.github/workflows/release-pr.yml`](.github/workflows/release-pr.yml). The PR consumes all of the committed changesets on `main` in order to bump versions of packages and update the `CHANGELOG` accordingly. Merging this PR will result in publishes to npm IF you've provided an `NPM_TOKEN` as a secret to your repo's GitHub actions (`https://github.com/apollographql/<repo-name>/settings/secrets/actions`). Please reach out to anyone in the `#npm-apollo-bot-owners` Slack channel for a token. Changesets will also publish a GitHub release when this PR is merged.

> Our action borrows directly from the action provided by `changesets`. Visit [the changesets action repo](https://github.com/changesets/action) for more info.

### Removing Changesets

If you're not interested in using `changesets`, just delete the [workflow](.github/workflows/release-pr.yml), uninstall the related dependencies, and delete the related scripts.

> For additional information on `changesets`, [visit the docs](https://github.com/changesets/changesets#documentation).

## CodeSandbox CI

> At the time of writing this, CodeSandbox CI only works for public repos.

### Installation

[GitHub app](https://github.com/apps/codesandbox)
> Note: a GitHub _org_ admin must approve app installations. By adding a GitHub app to your repo, you'll be submitting a request for approval. At the time of writing this, the GitHub UI doesn't make this clear.

CodeSandbox CI provides an installable build of your package on every PR. If your package builds successfully, CS:CI will leave a comment on the PR with instructions on how to try out your build in a project. This gives contributors access to their work immediately, allowing them to manually test their builds or even use a fix right away.

CS:CI will also provide links to sandboxes which use your newly built package if you choose. This is configurable via the `sandboxes` field in [`.codesandbox/ci.json`](.codesandbox/ci.json). This field is a list of sandbox IDs which you can find via the CodeSandbox web interface. For example, the Apollo Server repo specifies both JS and TS Apollo Server sandboxes like so: `["apollo-server-typescript-3opde","apollo-server"]`.

> For additional information on configuring CS:CI, [visit the docs](https://codesandbox.io/docs/ci).

## Renovate

### Installation

[GitHub app](https://github.com/apps/renovate)

> Note: a GitHub _org_ admin must approve app installations. By adding a GitHub app to your repo, you'll be submitting a request for approval. At the time of writing this, the GitHub UI doesn't make this clear.

Renovate automates dependency updates. The bot will open and merge PRs with updates to a variety of dependencies (including but not limited to npm dependencies). Renovate is _highly_ configurable via the [renovate.json5](renovate.json5) file. Package restrictions and scheduling are just a couple things that we commonly configure.

If you've configured PRs to require approval (mentioned in [GitHub](#github)), you may want to also install [Renovate's Approve bot](https://github.com/apps/renovate-approve). The approve bot will approve all renovate PRs in order to appease the PR approval requirement.

If you're unfamiliar with Renovate, the docs are really worth perusing even if just to get an idea of what kinds of configuration are possible.

> For additional information on configuring Renovate, [visit the docs](https://docs.renovatebot.com/).

## Prettier

Prettier is an opinionated code formatting tool. 

To check for formatting issues:
`npm run prettier:check`

To auto-fix formatting issues:
`npm run prettier:fix`

This is enforced in CI via the `Prettier` job.

> For additional information on configuring Prettier, [visit the docs](https://prettier.io/docs/en/options).

## Volta

Volta is a fast JS toolchain manager. Similar in effect to nvm, Volta allows for projects to specify their node / npm versions and will automatically handle the switching for you.

If using [direnv](https://direnv.net/), Volta will automatically be installed for you. The node and npm versions are specified in [`package.json`](package.json) and Renovate handles keeping these versions up to date.

> For additional information on configuring Volta, [visit the docs](https://docs.volta.sh/guide/).