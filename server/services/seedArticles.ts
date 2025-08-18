import { db } from '../db';
import { articles } from '../../shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Seeds the database with the Nico Collins article and other initial content
 */
export async function seedArticles() {
  try {
    // Check if Nico Collins article already exists
    const [existingArticle] = await db.select()
      .from(articles)
      .where(eq(articles.slug, 'nico-collins-most-mispriced-elite-receiver-2025-drafts'));

    if (existingArticle) {
      console.log('✅ Nico Collins article already exists');
      return;
    }

    const nicoArticleContent = `# Nico Collins: The Most Mispriced Elite Receiver in 2025 Drafts

**Why the market's half-right about Collins, and why that creates the value edge**

The fantasy football community has largely figured out that Nico Collins is good. What they haven't figured out is *how good*, and more importantly, *how much better he's about to get*. 

This disconnect creates one of 2025's most significant value opportunities, hiding in plain sight at a reasonable 1/2 turn price point.

## The Market's Half-Truth

The consensus around Collins centers on a reasonable but incomplete narrative: 
- Good receiver who had a strong 2024 
- Benefits from improved QB play
- Worth drafting in the middle rounds
- Safe, solid option

This assessment captures Collins' floor but completely misses his ceiling. The market is pricing in past performance while ignoring the structural opportunity that's about to unfold.

## The Target Inheritance Math

Here's what changes everything: **Stefon Diggs is gone, and Tank Dell is coming off a significant injury**.

The target math isn't complicated:
- **Diggs**: 103 targets (departed)
- **Dell**: 51 targets through injury
- **Available targets**: 154+ targets becoming available

Even with conservative redistribution assumptions, Collins inherits 25-30% more targets. In Houston's offensive system, that translates to approximately 135-145 targets from his baseline 80.

## The Elite Threshold

Historical analysis reveals a clear pattern: receivers who cross certain thresholds break into elite territory.

**The Elite Trinity**:
1. **150+ targets**
2. **30%+ target share**  
3. **2.7+ yards per route run**

Collins already achieved the efficiency benchmark (2.7+ YPRR) in 2024. The target volume and share were the missing pieces. With Diggs gone and Dell's uncertainty, both barriers disappear.

## The Coordinator Factor

Nick Caley's track record provides crucial context. Throughout his coaching career, Caley has consistently funneled 28%+ target share to his primary receiver when given clear hierarchy.

**Caley's Target Funneling Pattern**:
- **2019-2021 Patriots**: Heavy concentration to primary receiver
- **2022-2023 Giants**: Similar patterns with available talent
- **2024 Texans**: Beginning of Collins emergence

With a clear WR1 and reduced competition, Caley's historical tendencies suggest heavy target concentration toward Collins.

## Why This Matters for Dynasty

The timing creates a perfect storm for dynasty value:

**Immediate Impact**: Collins enters 2025 as a clear alpha receiver with minimal target competition
**Age Curve**: 26 years old, entering prime seasons
**Situation Stability**: Multi-year offensive coordinator continuity
**Supporting Cast**: Strong QB play and complementary weapons

## The Draft Decision Point

In current 1/2 turn conversations, Collins represents a defining decision:
- **Safe Pick**: Established receiver with clear role
- **Value Pick**: Substantial upside potential at reasonable cost
- **Strategic Pick**: Fills WR1 need without premium investment

The question isn't whether Collins will be good—it's whether you'll be positioned for his breakout before the market adjusts.

## Conclusion: Market Inefficiency Window

The fantasy community will eventually recognize Collins' elite potential. Target inheritance math, historical precedent, and coordinator tendencies all point toward significant statistical improvement.

**The window exists because**:
- Market focuses on past performance rather than future opportunity
- Target inheritance impact is undervalued
- Elite threshold proximity isn't widely recognized

In dynasty formats where sustained production matters most, Collins offers both immediate value and long-term upside at a price that won't exist once his 2025 season begins.

The market's half-right about Nico Collins. The other half is where the value lives.

---

*This analysis reflects target share data through Week 14 of the 2024 season and coordinator tendencies from 2019-2024. Dynasty values fluctuate based on league settings and team construction.*`;

    const articleData = {
      slug: 'nico-collins-most-mispriced-elite-receiver-2025-drafts',
      title: 'Nico Collins: The Most Mispriced Elite Receiver in 2025 Drafts',
      description: 'Why the market\'s half-right about Collins, and how target inheritance math creates one of 2025\'s most significant value opportunities.',
      content: nicoArticleContent,
      excerpt: 'The fantasy community has figured out that Nico Collins is good. What they haven\'t figured out is how good, and more importantly, how much better he\'s about to get. This disconnect creates one of 2025\'s most significant value opportunities.',
      category: 'Player Analysis',
      tags: ['WR', 'Nico Collins', 'Dynasty', 'Value', 'Target Share', 'Texans'],
      readTime: '8 min',
      featured: true,
      published: true,
      author: 'OTC Team',
      authorBio: 'Advanced analytics team focused on identifying market inefficiencies in dynasty fantasy football.',
      metaKeywords: ['Nico Collins', 'Fantasy Football', 'Dynasty', 'WR Analysis', 'Target Share', 'Market Value']
    };

    // Insert the article
    const [newArticle] = await db.insert(articles)
      .values(articleData)
      .returning();

    console.log('✅ Successfully seeded Nico Collins article:', newArticle.title);

    // Add a few more sample articles for the platform
    const additionalArticles = [
      {
        slug: 'target-competition-analysis-framework',
        title: 'Target Competition Analysis Framework',
        description: 'Comprehensive methodology for evaluating WR target competition and projecting usage in complex offensive systems.',
        content: '# Target Competition Analysis Framework\n\nA systematic approach to understanding target distribution...',
        excerpt: 'Understanding target competition is crucial for accurate WR projections. This framework breaks down the key factors.',
        category: 'Methodology',
        tags: ['WR', 'Targets', 'Methodology', 'Projection'],
        readTime: '12 min',
        featured: false,
        published: true,
        author: 'OTC Analytics',
        authorBio: 'Data science team specializing in fantasy football analytics.',
        metaKeywords: ['Target Competition', 'WR Analysis', 'Fantasy Football', 'Methodology']
      },
      {
        slug: 'rb-committees-2025-navigation-guide',
        title: 'Navigating RB Committees in 2025',
        description: 'Strategic framework for evaluating and targeting running backs in committee situations across NFL teams.',
        content: '# Navigating RB Committees in 2025\n\nCommittee backfields present unique challenges and opportunities...',
        excerpt: 'Committee backfields require different evaluation strategies. Here\'s how to identify value in messy situations.',
        category: 'Position Strategy',
        tags: ['RB', 'Committees', 'Strategy', 'Value'],
        readTime: '10 min',
        featured: true,
        published: true,
        author: 'OTC Strategy',
        authorBio: 'Strategic analysis team focused on positional value and market trends.',
        metaKeywords: ['RB Committees', 'Running Backs', 'Fantasy Football', 'Strategy']
      }
    ];

    // Insert additional articles
    for (const article of additionalArticles) {
      await db.insert(articles).values(article);
    }

    console.log('✅ Successfully seeded all articles');
    
  } catch (error) {
    console.error('❌ Error seeding articles:', error);
    throw error;
  }
}