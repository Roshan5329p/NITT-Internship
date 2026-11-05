export type NavSection = 'Platform' | 'Dashboards' | 'Customers' | 'Pricing' | 'Resources' | 'Contact';

export interface SignalItem {
  id: string;
  source: 'Linear' | 'GitHub' | 'Datadog' | 'PagerDuty' | 'Jira' | 'Slack';
  systemHash: string;
  timestamp: string;
  title: string;
  priority: 'High' | 'Med' | 'Low';
  status: 'Nominal' | 'Warning' | 'Critical';
  value: string;
  metric: string;
}

export interface ControlQueueItem {
  id: string;
  code: string;
  title: string;
  priority: 'High' | 'Med' | 'Low';
  signalsCount: number;
  status: 'pending' | 'reviewing' | 'executed';
  owner: string;
  impact: string;
  date: string;
  notes?: string;
}

export interface CaseStudy {
  id: 'northline' | 'meridian';
  author: string;
  role: string;
  company: string;
  quote: string;
  bgColor: string;
  textColor: string;
  teamSize: string;
  industry: string;
  keyMetric: string;
  keyMetricLabel: string;
  challenge: string;
  solution: string;
  results: string[];
}
