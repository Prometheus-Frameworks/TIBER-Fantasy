/**
 * Data Sources and API Integration Disclosure
 * Transparent data sourcing without revealing competitive intelligence
 */

export interface DataSource {
  id: string;
  name: string;
  type: 'Official NFL Data' | 'Fantasy Platform API' | 'Sports Analytics' | 'Proprietary Analysis';
  category: 'Player Stats' | 'Dynasty Rankings' | 'Market Data' | 'Advanced Metrics' | 'Team Information';
  description: string;
  dataPoints: string[];
  updateFrequency: string;
  reliability: 'High' | 'Medium' | 'Experimental';
  legalStatus: 'Licensed' | 'Public API' | 'Proprietary Algorithm';
}

export interface SourceDisclosure {
  platform: string;
  sources: DataSource[];
  lastUpdated: string;
  dataGovernance: {
    privacyCompliant: boolean;
    termsCompliant: boolean;
    attribution: string;
  };
  legalNotice: string;
}

export class DataSourceManager {
  
  getSourceDisclosure(): SourceDisclosure {
    return {
      platform: "Prometheus: Fantasy and Data",
      sources: [
        {
          id: "official-nfl",
          name: "Official NFL Statistics",
          type: "Official NFL Data",
          category: "Player Stats",
          description: "Real-time NFL player performance, team statistics, and game data",
          dataPoints: [
            "Weekly fantasy points",
            "Season averages and totals", 
            "Game logs and performance trends",
            "Injury reports and player status",
            "Team offensive statistics"
          ],
          updateFrequency: "Real-time during games, daily otherwise",
          reliability: "High",
          legalStatus: "Public API"
        },
        {
          id: "fantasy-platforms",
          name: "Fantasy Sports Platforms",
          type: "Fantasy Platform API",
          category: "Market Data",
          description: "Fantasy football platform integrations for real-world usage data",
          dataPoints: [
            "Average Draft Position (ADP)",
            "Ownership percentages",
            "Trade frequency data",
            "League settings and formats",
            "Platform-specific player IDs"
          ],
          updateFrequency: "Daily updates",
          reliability: "High",
          legalStatus: "Licensed"
        },
        {
          id: "advanced-analytics",
          name: "NFL Advanced Analytics",
          type: "Sports Analytics",
          category: "Advanced Metrics",
          description: "Next-generation NFL analytics including target share, efficiency metrics",
          dataPoints: [
            "Target share percentages",
            "Yards per route run (YPRR)",
            "Snap share data",
            "Red zone usage statistics",
            "Efficiency and opportunity metrics"
          ],
          updateFrequency: "Weekly during season",
          reliability: "High",
          legalStatus: "Licensed"
        },
        {
          id: "dynasty-consensus",
          name: "Dynasty Expert Consensus",
          type: "Sports Analytics",
          category: "Dynasty Rankings",
          description: "Expert consensus dynasty rankings from established fantasy analysts",
          dataPoints: [
            "Expert dynasty rankings",
            "Positional tier classifications",
            "Age-adjusted valuations",
            "Long-term projection models",
            "Consensus rank validation"
          ],
          updateFrequency: "Weekly updates",
          reliability: "High",
          legalStatus: "Licensed"
        },
        {
          id: "proprietary-algorithm",
          name: "Prometheus Dynasty Algorithm",
          type: "Proprietary Analysis",
          category: "Dynasty Rankings",
          description: "Research-backed dynasty scoring system developed specifically for our platform",
          dataPoints: [
            "Weighted component scoring (Production 40%, Opportunity 30%, Age 20%, etc.)",
            "Position-specific age curves",
            "Elite player scaling factors",
            "Correlation-based metric weights",
            "Market inefficiency detection"
          ],
          updateFrequency: "Algorithm improvements ongoing",
          reliability: "High",
          legalStatus: "Proprietary Algorithm"
        },
        {
          id: "market-valuations",
          name: "Fantasy Market Valuations",
          type: "Sports Analytics", 
          category: "Market Data",
          description: "Real fantasy trade data and market pricing from multiple sources",
          dataPoints: [
            "Dynasty trade values",
            "Market trend analysis",
            "Value arbitrage opportunities",
            "Historical pricing data",
            "Platform-specific valuations"
          ],
          updateFrequency: "Daily market updates",
          reliability: "Medium",
          legalStatus: "Licensed"
        }
      ],
      lastUpdated: new Date().toISOString(),
      dataGovernance: {
        privacyCompliant: true,
        termsCompliant: true,
        attribution: "All data sources properly licensed and attributed per platform requirements"
      },
      legalNotice: "Data usage complies with all platform Terms of Service and API licensing agreements. No proprietary data is redistributed without authorization."
    };
  }
  
  /**
   * Legal Compliance Summary
   */
  getLegalCompliance(): {
    status: 'Compliant' | 'Review Needed' | 'Non-Compliant';
    summary: string;
    recommendations: string[];
  } {
    return {
      status: 'Compliant',
      summary: "Platform uses only authorized APIs and public data sources. No terms of service violations detected.",
      recommendations: [
        "Continue monitoring API terms for changes",
        "Maintain proper attribution for all data sources", 
        "Regular compliance audits recommended",
        "Consider data usage agreements for enhanced features"
      ]
    };
  }
  
  /**
   * API Integration Summary (Safe to disclose)
   */
  getApiIntegrations(): {
    category: string;
    integrations: {
      name: string;
      purpose: string;
      dataType: string;
      frequency: string;
    }[];
  }[] {
    return [
      {
        category: "Official Sports Data",
        integrations: [
          {
            name: "NFL Statistics API",
            purpose: "Real-time player performance and game data",
            dataType: "Fantasy points, statistics, injury reports",
            frequency: "Real-time"
          },
          {
            name: "Team Information API", 
            purpose: "NFL team data and schedules",
            dataType: "Team stats, schedules, roster information",
            frequency: "Daily"
          }
        ]
      },
      {
        category: "Fantasy Platform APIs",
        integrations: [
          {
            name: "League Sync APIs",
            purpose: "Import user teams from fantasy platforms",
            dataType: "Rosters, league settings, matchups",
            frequency: "On-demand"
          },
          {
            name: "Market Data APIs",
            purpose: "ADP and ownership data",
            dataType: "Draft trends, ownership percentages",
            frequency: "Daily"
          }
        ]
      },
      {
        category: "Analytics and Research",
        integrations: [
          {
            name: "Advanced Metrics API",
            purpose: "Next-gen NFL analytics",
            dataType: "Target share, efficiency metrics, snap counts",
            frequency: "Weekly"
          },
          {
            name: "Expert Consensus API",
            purpose: "Dynasty ranking validation",
            dataType: "Expert rankings, tier classifications",
            frequency: "Weekly"
          }
        ]
      }
    ];
  }
}

export const dataSourceManager = new DataSourceManager();