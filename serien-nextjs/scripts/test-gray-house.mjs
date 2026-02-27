/**
 * Temporary script to process "The Gray House" article
 * This will be executed once and then can be deleted
 */

import { runContentPipeline } from './pipeline-v1.ts';

const crawledContent = `
# The Gray House's True Story, Explained

Created by Darrell Fetty, Leslie Greif, and John Sayles, 'The Gray House' is a political drama series that explores the inner workings of a unique spy network. The story is set in the 1860s, over the course of the Civil War. The Van Lew family is a respected name in Richmond, Virginia's social circles. However, unbeknownst to their neighbors, matriarch Eliza and her daughter, Elizabeth, are actually active members in the city's small but formidable abolitionist community. As a result, the Van Lew household becomes a notable name in the town's Underground Railroad network that works toward emancipating former slaves and helping them escape to the North.

However, soon enough, Confederate sentiments win out in Richmond, making it the capital of the breakaway republic and home to Confederate president Jefferson Davis. As a result, the railroad becomes a network of spies, with former slave, Mary Jane Richards, and local prostitute, ClaraParishh joining the Van Lews in espionage. The historical series remains steeped in relevant socio-political themes, employing accounts from the past to tell a story about freedom and the fight for it.

## The Gray House is Based on Real Historical Accounts of Elizabeth Van Lew's Life

Although 'The Gray House' is not a biographical story, it remains deeply rooted in the real-life history of the Civil War. Specifically, it centers around a dramatized narrative about the Underground Railroad-turned-spy network operated by Elizabeth Van Lew in the 1860s. In real life, Van Lew, born in Richmond, Virginia, to John Van Lew and Eliza Baker, played a crucial role in swaying the tide of the American Civil War in favor of the Union. In the build-up to the Civil War, Van Lew and her widowed mother retained firm abolitionist sentiments. Even though the family owned multiple slaves, Van Lew fought for the freedom of many of them from the shadows.

Van Lew and her mother were also reportedly supporters of the African colonization movement. As a result, when the Civil War broke out, and Richmond became a crucial epicenter for the South, Van Lew continued to support the Union and worked in their favor. Instead of escaping to the South, she remained in the Virginia town and utilized her high-society standing and family's resources to form hidden spy networks to aid and abet the Union soldiers. This network came to be known as the Richmond Underground. Alongside passing messages, the network worked with imprisoned soldiers and facilitated the escape of many civilians from under the rule of the Confederacy.

As a result, at the height of the Civil War, Van Lew found herself becoming somewhat of a spy master, moving valuable information to the Union through code languages, invisible ink, and courier agents. Over the years, the legend around Van Lew grew, creating many stories, both true and exaggerated, about her person. In 'The Gray House,' the narrative employs a dramatized version of the historical figure, highlighting the role she played in the American Civil War as a notable spy. Many of the storylines surrounding her find direct parallels in real-life, historically recorded incidents. However, many aspects of Elizabeth's character, such as her personal relationships and day-to-day lifestyle, remain a work of fictionalization. As such, the show finds a blend of fact and fiction in its narrative.

## The Gray House Fictionalizes Certain Aspects of History

While 'The Gray House' strives for historical accuracy, the show also occasionally diverges from it, allowing creative liberty to determine the course of the narrative at times. This is especially true in the details of the depiction of Elizabeth's secret Richmond spy circle. In reality, the exact and detailed inner workings of the Richmond Underground remain cloaked in ambiguity. Therefore, the show's creators and their team of screenwriters had to rely on general research and their own creativity to fill in many gaps. Furthermore, at times, the show also steers away from factual records and entertains more fabled parts of history. This is most notably present in the narrative surrounding Mary Jane.

While Mary Jane Richards was a real-life Black Union spy in Richmond, her recorded life story isn't identical to that of her on-screen counterpart. Most notably, Mary Jane's on-screen espionage efforts inside the household of the Confederate President Jefferson Davis seem to be largely fictitious. Although there is a fable surrounding Richards working at Davis' home, it isn't the entire truth. The story originated through Annie Van Lew Hall, Elizabeth Van Lew's niece, who spoke about her memories of an African American spy in the days of the Civil War. However, in actuality, Richards only ever shared a story about once entering Davis' house in his absence and investigating for some information.

'The Gray House' builds upon the story of Richards' as a spy who volunteers to have herself implanted at Davis' house in the service of the cause. Even so, while Richards' real espionage experience with Davis may have differed in real life, it still presumably contributed significantly to the cause of the Richmond Underground. Therefore, despite the lack of historical records to support the latter, the on-screen depiction of Mary Jane retains its sense of realism due to its close connection to the real life of Richards. The latter played a notable part in the Richmond Underground network and was often involved with pro-union activities. While Mary Jane's on-screen portrayal is a more evident example of the show's reliance on slight fictionalizations, this can be found in other corners of the storytelling. Yet, the story's general roots in reality remain, informing its sense of historical authenticity.

## The Gray House Portrays the Unblemished Truth of Slavery in America

As a story about the American Civil War, 'The Gray House' explores major themes of race, slavery, and freedom on a socio-political level. Regardless of its reliance on dramatized storytelling, the show maintains a sense of realism in terms of its depiction of the South in the 1860s. Through a number of characters like Mary Jane, Jericho Bowser, Isham Worthy, and more, the show depicts the harsh reality that Black Americans experience during slavery in America. Furthermore, it shines a light on the cruel history of the Confederacy, showcasing the moral, social, and political conflict that caused the brutal war between the North and South.

In a conversation with Variety, executive producer Lori McCreary spoke about the show's commitment to portraying a realistic image of history. She said, "We are not whitewashing, we are not sugar-coating the fact that African Americans were enslaved. They weren't treated as a full person. When you come out of watching these eight hours, maybe you will look at someone who looks like Morgan or me differently. You will understand their experience, their ancestors' experience, and you will be able to relate." Ultimately, this commitment to historical accuracy in terms of themes and worldbuilding allows the show to tell a realistic story about the Richmond Underground.
`;

async function main() {
  console.log('🚀 Starting Gray House article processing...\n');
  
  try {
    const result = await runContentPipeline({
      title: "The Gray House's True Story, Explained",
      url: "https://thecinemaholic.com/the-gray-house-true-story/",
      text: crawledContent,
      useFullTextMode: true, // Activate full article mode with proportional length
    });
    
    if (result.skipped) {
      console.log(`\n⚠️  Article was skipped: ${result.reason}`);
      if (result.draft) {
        console.log(`   Draft saved: ${result.draft.id}`);
      }
    } else if (result.success) {
      console.log(`\n✅ Article published successfully!`);
      console.log(`   ID: ${result.article.id}`);
      console.log(`   Slug: ${result.article.slug}`);
      console.log(`   Title: ${result.article.title}`);
    }
    
  } catch (error) {
    console.error('❌ Pipeline failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
