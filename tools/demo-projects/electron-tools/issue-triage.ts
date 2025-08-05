/**
 * Electron Issue Triage Bot (Simplified Example)
 * 
 * This script demonstrates how Electron might automate issue triage
 * for the large volume of issues in an open source project.
 */

import { Octokit } from '@octokit/rest';

interface IssueData {
  id: number;
  number: number;
  title: string;
  body: string;
  labels: string[];
  user: {
    login: string;
  };
  created_at: string;
}

interface TriageResult {
  issue: IssueData;
  addLabels: string[];
  removeLabels: string[];
  comment?: string;
}

class IssueTriage {
  private octokit: Octokit;
  private owner: string;
  private repo: string;
  
  // Keywords for categorizing issues
  private readonly categoryKeywords = {
    'renderer': ['renderer', 'web contents', 'webcontents', 'blink', 'v8', 'dom'],
    'main': ['main process', 'browser process', 'app', 'browserwindow'],
    'api': ['api', 'function', 'method', 'return value', 'parameter'],
    'crash': ['crash', 'segfault', 'segmentation fault', 'sigsegv', 'core dump'],
    'performance': ['performance', 'slow', 'memory leak', 'cpu', 'memory usage'],
    'documentation': ['docs', 'documentation', 'example', 'tutorial'],
    'windows': ['windows', 'win32', 'microsoft', 'win10', 'win11'],
    'macos': ['macos', 'osx', 'darwin', 'mac', 'apple'],
    'linux': ['linux', 'ubuntu', 'fedora', 'debian', 'x11', 'wayland']
  };
  
  // Required issue template sections
  private readonly templateSections = [
    'description',
    'electron version',
    'platform',
    'expected behavior',
    'current behavior',
    'reproduction'
  ];
  
  constructor(token: string, owner: string, repo: string) {
    this.octokit = new Octokit({ auth: token });
    this.owner = owner;
    this.repo = repo;
  }
  
  /**
   * Get recent issues for triage
   */
  async getRecentIssues(count: number = 10): Promise<IssueData[]> {
    console.log(`Fetching ${count} recent issues for triage...`);
    
    try {
      const response = await this.octokit.issues.listForRepo({
        owner: this.owner,
        repo: this.repo,
        state: 'open',
        sort: 'created',
        direction: 'desc',
        per_page: count
      });
      
      return response.data as IssueData[];
    } catch (error) {
      console.error('Error fetching issues:', error);
      throw error;
    }
  }
  
  /**
   * Perform triage on a single issue
   */
  triageIssue(issue: IssueData): TriageResult {
    console.log(`Triaging issue #${issue.number}: ${issue.title}`);
    
    const result: TriageResult = {
      issue,
      addLabels: [],
      removeLabels: []
    };
    
    // Check if issue uses template
    if (!this.checkIssueTemplate(issue)) {
      result.addLabels.push('needs-template');
      result.comment = this.generateTemplateComment();
      return result;
    }
    
    // Categorize issue based on content
    this.categorizeIssue(issue, result);
    
    // Check for duplicate indicators
    if (this.checkForDuplicate(issue)) {
      result.addLabels.push('possible-duplicate');
    }
    
    // Check for good first issue candidates
    if (this.isGoodFirstIssue(issue)) {
      result.addLabels.push('good-first-issue');
    }
    
    return result;
  }
  
  /**
   * Apply triage results to the GitHub issue
   */
  async applyTriageResults(result: TriageResult): Promise<void> {
    const { issue, addLabels, removeLabels, comment } = result;
    
    console.log(`Applying triage results for issue #${issue.number}:`);
    console.log(`- Adding labels: ${addLabels.join(', ')}`);
    console.log(`- Removing labels: ${removeLabels.join(', ')}`);
    
    try {
      // Add labels
      if (addLabels.length > 0) {
        await this.octokit.issues.addLabels({
          owner: this.owner,
          repo: this.repo,
          issue_number: issue.number,
          labels: addLabels
        });
      }
      
      // Remove labels
      for (const label of removeLabels) {
        await this.octokit.issues.removeLabel({
          owner: this.owner,
          repo: this.repo,
          issue_number: issue.number,
          name: label
        });
      }
      
      // Add comment if necessary
      if (comment) {
        await this.octokit.issues.createComment({
          owner: this.owner,
          repo: this.repo,
          issue_number: issue.number,
          body: comment
        });
      }
      
      console.log(`Triage applied successfully for issue #${issue.number}`);
    } catch (error) {
      console.error(`Error applying triage for issue #${issue.number}:`, error);
      throw error;
    }
  }
  
  /**
   * Check if the issue follows the template
   */
  private checkIssueTemplate(issue: IssueData): boolean {
    const body = issue.body.toLowerCase();
    
    // Check for presence of required sections
    const missingSections = this.templateSections.filter(section => 
      !body.includes(section.toLowerCase())
    );
    
    return missingSections.length === 0;
  }
  
  /**
   * Categorize issue based on its content
   */
  private categorizeIssue(issue: IssueData, result: TriageResult): void {
    const content = `${issue.title} ${issue.body}`.toLowerCase();
    
    // Check for each category
    for (const [category, keywords] of Object.entries(this.categoryKeywords)) {
      if (keywords.some(keyword => content.includes(keyword))) {
        result.addLabels.push(category);
      }
    }
    
    // Add type label based on content analysis
    if (content.includes('feature') || content.includes('enhancement')) {
      result.addLabels.push('enhancement');
    } else if (content.includes('bug') || content.includes('issue') || content.includes('problem')) {
      result.addLabels.push('bug');
    } else {
      result.addLabels.push('question');
    }
  }
  
  /**
   * Check for indicators that this might be a duplicate issue
   */
  private checkForDuplicate(issue: IssueData): boolean {
    // This would be more sophisticated in a real implementation,
    // possibly using a database of known issues or NLP
    const commonDuplicatePatterns = [
      'same as issue',
      'similar to',
      'duplicate of',
      'already reported'
    ];
    
    const content = `${issue.title} ${issue.body}`.toLowerCase();
    return commonDuplicatePatterns.some(pattern => content.includes(pattern));
  }
  
  /**
   * Check if this could be a good first issue
   */
  private isGoodFirstIssue(issue: IssueData): boolean {
    // This would have more sophisticated logic in a real implementation
    const content = `${issue.title} ${issue.body}`.toLowerCase();
    
    // Simple heuristics for demo purposes
    const isDocumentation = content.includes('documentation') || content.includes('docs');
    const isSimpleFix = content.includes('typo') || content.includes('simple fix');
    const isComplex = 
      content.includes('crash') || 
      content.includes('segfault') ||
      content.includes('performance') ||
      content.length > 3000; // Long issues are likely complex
    
    return (isDocumentation || isSimpleFix) && !isComplex;
  }
  
  /**
   * Generate a comment asking for template usage
   */
  private generateTemplateComment(): string {
    return `
Thank you for reporting this issue! 

It appears that this issue doesn't follow our issue template. Using the template helps us triage issues more effectively and ensures we have all the information needed to investigate.

Could you please edit your issue to include all the sections from our issue template? This includes:
${this.templateSections.map(section => `- ${section}`).join('\n')}

You can find our issue template when you create a new issue. Thanks for your understanding!
`;
  }
}

// Example usage (would need a GitHub token to actually run)
async function runTriageDemo() {
  const token = process.env.GITHUB_TOKEN || 'fake-token';
  const triage = new IssueTriage(token, 'electron', 'electron');
  
  try {
    // Simulated issues for demo purposes
    const sampleIssues: IssueData[] = [
      {
        id: 1,
        number: 12345,
        title: 'Crash when opening DevTools on Windows',
        body: `
Description: The application crashes when DevTools is opened
Electron version: 25.0.0
Platform: Windows 10
Expected behavior: DevTools should open without crashing
Current behavior: The application crashes with a segmentation fault
Reproduction: 1. Open app 2. Right-click 3. Select "Inspect Element"
`,
        labels: [],
        user: { login: 'user1' },
        created_at: new Date().toISOString()
      },
      {
        id: 2,
        number: 12346,
        title: 'Feature request: Add API for accessing clipboard history',
        body: `
I'd like to request a new API for accessing clipboard history.
This would be useful for my application which needs to track copied items.

Thanks!
`,
        labels: [],
        user: { login: 'user2' },
        created_at: new Date().toISOString()
      }
    ];
    
    // Perform triage
    for (const issue of sampleIssues) {
      const result = triage.triageIssue(issue);
      console.log(JSON.stringify(result, null, 2));
      
      // This would actually apply the results in a real implementation
      // await triage.applyTriageResults(result);
    }
  } catch (error) {
    console.error('Error running triage demo:', error);
  }
}

// Run the demo if executed directly
if (require.main === module) {
  runTriageDemo().catch(console.error);
}

export { IssueTriage };
