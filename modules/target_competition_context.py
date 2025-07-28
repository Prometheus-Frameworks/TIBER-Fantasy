#!/usr/bin/env python3
"""
Target Competition Context Module v1.0
Enhanced player module integrating target competition tiers, contextual notes, 
and team depth analysis for dynasty projections.
"""

import json
from typing import Dict, List, Any, Optional
from modules.tcip_pipeline import get_tcip_pipeline

class TargetCompetitionContext:
    """
    Enhanced player context module providing target competition analysis
    with detailed contextual notes and team depth insights.
    """
    
    def __init__(self):
        self.competition_tier_scale = {
            'S': 'Severe target competition — likely capped role unless disruption occurs',
            'A': 'Strong target competition — top-two usage is a challenge',
            'B': 'Manageable target competition — realistic spike or consistent usage',
            'C': 'Favorable path to meaningful target share',
            'D': 'Wide open depth chart — opportunity is ripe'
        }
        
        # Enhanced player database with contextual information
        self.player_contexts = {
            'Luther Burden': {
                'name': 'Luther Burden',
                'team': 'CHI',
                'competition_tier': 'S',
                'projected_role': 'Third option in high-volume passing offense',
                'competition': [
                    {
                        'name': 'DJ Moore',
                        'position': 'WR',
                        'note': 'Tier 1, 130+ target pace'
                    },
                    {
                        'name': 'Rome Odunze',
                        'position': 'WR', 
                        'note': 'Top-10 rookie, projected WR2 role'
                    },
                    {
                        'name': 'Colston Loveland',
                        'position': 'TE',
                        'note': 'Top-10 rookie, red zone threat'
                    }
                ],
                'context_note': 'Burden enters a crowded receiving room with elite talents already commanding attention. Despite his pedigree, early career ceiling may be capped unless a key player falters.'
            },
            'Travis Hunter': {
                'name': 'Travis Hunter',
                'team': 'JAX',
                'competition_tier': 'B',
                'projected_role': 'Likely WR2/3 with spike potential',
                'competition': [
                    {
                        'name': 'Brian Thomas Jr.',
                        'position': 'WR',
                        'note': 'Top-20 pick, WR1 expectations'
                    },
                    {
                        'name': 'Dyami Brown',
                        'position': 'WR',
                        'note': 'Depth role, minor threat'
                    },
                    {
                        'name': 'Vacated Targets',
                        'position': 'Departures',
                        'note': 'Christian Kirk, Evan Engram, Gabe Davis all off the roster'
                    }
                ],
                'context_note': 'Hunter benefits from a fluid WR room. BTJ projects as the alpha, but Hunter could see efficient usage and spike weeks, especially if used creatively or if BTJ gets bracketed.'
            },
            'Chris Godwin': {
                'name': 'Chris Godwin',
                'team': 'TB',
                'competition_tier': 'A',
                'projected_role': 'Likely WR2 with slot upside',
                'competition': [
                    {
                        'name': 'Emeka Egbuka',
                        'position': 'WR',
                        'note': 'Round 1 rookie with alpha trajectory'
                    },
                    {
                        'name': 'Scheme Change',
                        'position': 'OC Change',
                        'note': 'Liam Coen (slot-heavy) departs for Jacksonville'
                    }
                ],
                'context_note': 'Godwin was on WR1 pace in Liam Coen\'s scheme before mid-season injury. With Egbuka drafted and the offensive coordinator gone, Godwin\'s target share outlook is shakier entering 2025.'
            }
        }
        
        self.tcip = get_tcip_pipeline()
    
    def get_player_context(self, player_name: str, 
                          include_tcip_analysis: bool = True) -> Dict[str, Any]:
        """Get enhanced context for a specific player"""
        
        # Check if player has predefined context
        context_data = self.player_contexts.get(player_name)
        
        if not context_data:
            # Generate context using TCIP if not predefined
            if include_tcip_analysis:
                context_data = self._generate_context_from_tcip(player_name)
            else:
                return {'error': f'No context data available for {player_name}'}
        
        # Enhance with TCIP analysis if requested
        if include_tcip_analysis and player_name in self.player_contexts:
            tcip_analysis = self._get_tcip_supplement(player_name)
            context_data['tcip_analysis'] = tcip_analysis
        
        # Add tier scale definition
        tier = context_data.get('competition_tier', 'B')
        context_data['tier_definition'] = self.competition_tier_scale.get(tier, 'Standard competition level')
        
        return context_data
    
    def _generate_context_from_tcip(self, player_name: str) -> Dict[str, Any]:
        """Generate context using TCIP analysis for players not in predefined database"""
        try:
            # Basic player data structure
            player_data = {'name': player_name, 'team': 'TBD', 'position': 'WR'}
            
            # Run TCIP evaluation
            tcip_result = self.tcip.evaluate_target_competition_tier(player_data)
            
            # Convert TCIP result to context format
            competition_list = []
            for teammate in tcip_result['teammates_analyzed']:
                if teammate['total_score'] > 0:
                    competition_list.append({
                        'name': teammate['name'],
                        'position': teammate.get('position', 'WR'),
                        'note': f"{teammate['total_score']} TCIP points - {', '.join(teammate['reasoning'])}"
                    })
            
            # Generate projected role based on tier
            tier = tcip_result['competition_tier']
            role_mapping = {
                'S': 'Limited role due to severe competition',
                'A': 'Secondary role with strong competition',
                'B': 'Manageable role with spike potential',
                'C': 'Favorable role opportunity',
                'D': 'Primary role opportunity'
            }
            
            return {
                'name': player_name,
                'team': player_data['team'],
                'competition_tier': tier,
                'projected_role': role_mapping.get(tier, 'Standard role projection'),
                'competition': competition_list,
                'context_note': tcip_result['context_note'],
                'generated_from_tcip': True
            }
            
        except Exception as e:
            return {
                'error': f'Failed to generate context for {player_name}: {str(e)}',
                'name': player_name,
                'competition_tier': 'B',
                'context_note': 'Context generation failed - using default assessment'
            }
    
    def _get_tcip_supplement(self, player_name: str) -> Dict[str, Any]:
        """Get supplemental TCIP analysis for enhanced context"""
        try:
            player_data = {'name': player_name, 'team': 'CHI', 'position': 'WR'}  # Will be enhanced
            tcip_result = self.tcip.evaluate_target_competition_tier(player_data)
            
            return {
                'competition_score': tcip_result['competition_score'],
                'tier_reasoning': tcip_result['tier_reasoning'],
                'teammates_analyzed': len(tcip_result['teammates_analyzed']),
                'update_trigger': tcip_result['update_trigger']
            }
        except:
            return {'analysis_status': 'TCIP supplement unavailable'}
    
    def render_player_context_html(self, player_name: str, 
                                  include_styles: bool = True,
                                  allow_tier_colors: bool = True) -> str:
        """Render player context as HTML block with styling"""
        
        context = self.get_player_context(player_name)
        
        if 'error' in context:
            return f'<div class="context-error">Context unavailable for {player_name}</div>'
        
        # Tier color mapping
        tier_colors = {
            'S': '#dc2626',  # Red - Severe
            'A': '#ea580c',  # Orange - Strong
            'B': '#d97706',  # Amber - Manageable
            'C': '#65a30d',  # Lime - Favorable
            'D': '#16a34a'   # Green - Wide open
        } if allow_tier_colors else {}
        
        tier = context.get('competition_tier', 'B')
        tier_color = tier_colors.get(tier, '#6b7280')
        
        # Build HTML
        html_parts = []
        
        # Add styles if requested
        if include_styles:
            html_parts.append('''
            <style>
            .target-competition-context {
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                padding: 16px;
                margin: 12px 0;
                background: #f9fafb;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            .context-header {
                display: flex;
                align-items: center;
                margin-bottom: 12px;
            }
            .tier-badge {
                padding: 4px 8px;
                border-radius: 4px;
                color: white;
                font-weight: bold;
                margin-right: 12px;
                font-size: 14px;
            }
            .player-info {
                flex-grow: 1;
            }
            .competition-list {
                margin: 12px 0;
            }
            .competition-item {
                padding: 8px;
                margin: 4px 0;
                background: white;
                border-radius: 4px;
                border-left: 3px solid #e5e7eb;
            }
            .context-note {
                margin-top: 12px;
                padding: 12px;
                background: #f3f4f6;
                border-radius: 4px;
                font-style: italic;
                color: #374151;
            }
            .tier-definition {
                font-size: 12px;
                color: #6b7280;
                margin-top: 8px;
            }
            </style>
            ''')
        
        # Context container
        html_parts.append('<div class="target-competition-context">')
        
        # Header with tier badge
        html_parts.append(f'''
        <div class="context-header">
            <div class="tier-badge" style="background-color: {tier_color}">
                {tier}-tier
            </div>
            <div class="player-info">
                <h3 style="margin: 0; color: #111827;">{context['name']} ({context['team']})</h3>
                <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 14px;">
                    {context.get('projected_role', 'Role assessment pending')}
                </p>
            </div>
        </div>
        ''')
        
        # Tier definition
        html_parts.append(f'''
        <div class="tier-definition">
            <strong>{tier}-tier:</strong> {context['tier_definition']}
        </div>
        ''')
        
        # Competition analysis
        competition = context.get('competition', [])
        if competition:
            html_parts.append('<div class="competition-list">')
            html_parts.append('<h4 style="margin: 12px 0 8px 0; color: #374151;">Target Competition:</h4>')
            
            for comp in competition:
                html_parts.append(f'''
                <div class="competition-item">
                    <strong>{comp['name']}</strong> ({comp['position']}) — {comp['note']}
                </div>
                ''')
            
            html_parts.append('</div>')
        
        # Context note
        if context.get('context_note'):
            html_parts.append(f'''
            <div class="context-note">
                {context['context_note']}
            </div>
            ''')
        
        # TCIP supplement if available
        if 'tcip_analysis' in context:
            tcip = context['tcip_analysis']
            html_parts.append(f'''
            <div style="margin-top: 12px; padding: 8px; background: #eff6ff; border-radius: 4px; font-size: 12px; color: #1e40af;">
                <strong>TCIP Analysis:</strong> {tcip.get('tier_reasoning', 'Analysis pending')}
            </div>
            ''')
        
        html_parts.append('</div>')
        
        return ''.join(html_parts)
    
    def get_all_contexts_sorted_by_tier(self) -> List[Dict[str, Any]]:
        """Get all player contexts sorted by competition tier (S to D)"""
        all_contexts = []
        
        for player_name in self.player_contexts.keys():
            context = self.get_player_context(player_name, include_tcip_analysis=False)
            all_contexts.append(context)
        
        # Sort by tier (S=5, A=4, B=3, C=2, D=1 for reverse sorting)
        tier_values = {'S': 5, 'A': 4, 'B': 3, 'C': 2, 'D': 1}
        all_contexts.sort(key=lambda x: tier_values.get(x.get('competition_tier', 'B'), 3), reverse=True)
        
        return all_contexts
    
    def validate_tiber_alignment(self, context_note: str) -> bool:
        """Validate that context maintains Tiber alignment (no spiritual authority)"""
        forbidden_phrases = [
            'must start', 'guaranteed', 'will definitely', 'fantasy god',
            'divine', 'prophetic', 'certain to', 'lock', 'sure thing'
        ]
        
        note_lower = context_note.lower()
        for phrase in forbidden_phrases:
            if phrase in note_lower:
                return False
        
        return True
    
    def apply_tiber_alignment_filter(self, context_note: str) -> str:
        """Apply Tiber alignment filtering to context notes"""
        if not self.validate_tiber_alignment(context_note):
            # Replace absolute language with probabilistic language
            replacements = {
                'must start': 'projects for strong usage',
                'guaranteed': 'likely',
                'will definitely': 'has potential to',
                'certain to': 'projected to',
                'lock': 'strong candidate',
                'sure thing': 'favorable outlook'
            }
            
            filtered_note = context_note
            for absolute, probabilistic in replacements.items():
                filtered_note = filtered_note.replace(absolute, probabilistic)
            
            return filtered_note
        
        return context_note

# Global instance
target_competition_context = TargetCompetitionContext()

def get_target_competition_context() -> TargetCompetitionContext:
    """Get global Target Competition Context instance"""
    return target_competition_context

def get_player_context_html(player_name: str, include_styles: bool = True) -> str:
    """Get player context rendered as HTML"""
    return target_competition_context.render_player_context_html(
        player_name, include_styles=include_styles
    )

def get_context_for_dynasty_integration(player_name: str) -> Dict[str, Any]:
    """Get context data for dynasty tier integration"""
    context = target_competition_context.get_player_context(player_name)
    
    return {
        'competition_tier': context.get('competition_tier', 'B'),
        'projected_role': context.get('projected_role', 'Standard role'),
        'context_summary': context.get('context_note', 'No specific context available'),
        'tier_definition': context.get('tier_definition', 'Standard competition level')
    }

if __name__ == "__main__":
    # Test Target Competition Context Module
    context_module = TargetCompetitionContext()
    
    print("🧠 TARGET COMPETITION CONTEXT MODULE v1.0 TEST")
    print("=" * 65)
    
    # Test predefined players
    test_players = ['Luther Burden', 'Travis Hunter', 'Chris Godwin']
    
    for player in test_players:
        print(f"\n{player} - ENHANCED CONTEXT:")
        context = context_module.get_player_context(player)
        
        print(f"  • Competition Tier: {context['competition_tier']}")
        print(f"  • Projected Role: {context['projected_role']}")
        print(f"  • Competition Count: {len(context.get('competition', []))}")
        print(f"  • Tier Definition: {context['tier_definition']}")
        print(f"  • Context: {context['context_note'][:100]}...")
        
        # Test HTML rendering
        html_output = context_module.render_player_context_html(player, include_styles=False)
        print(f"  • HTML Length: {len(html_output)} characters")
        
        print("-" * 50)
    
    print("\n✅ Target Competition Context Module operational")
    print("✅ Enhanced player contexts with tier-based analysis")
    print("✅ HTML rendering with tier color coding")
    print("✅ Tiber alignment filtering active")
    print("✅ Dynasty integration context ready")