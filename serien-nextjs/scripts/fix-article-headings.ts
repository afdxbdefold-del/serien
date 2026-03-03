import prisma from '../lib/prisma';

async function fixArticleHeadings() {
  const slug = 'the-night-agent-staffel-3-ende-erklaert-wird-praesident-hagan-verhaftet';
  
  const newContent = `<p class="lead">Netflix setzt die Handlung von „The Night Agent" in Staffel 3 mit einem Zeitsprung fort und schickt <a href="/figur/peter-sutherland-the-night-agent" class="text-blue-600 hover:text-blue-800 underline font-medium">Peter Sutherland</a> in einen neuen Einsatz, der beruflich wie privat an seine Grenzen führt. Ausgangspunkt ist der Deal, den Peter am Ende von Staffel 2 mit <a href="/figur/jacob-monroe-the-night-agent" class="text-blue-600 hover:text-blue-800 underline font-medium">Jacob Monroe</a> geschlossen hat, der unter dem Namen „the Broker" operiert. Diese Vereinbarung rettete zwar Hunderte Menschen, verschaffte Monroe aber zugleich einen direkten Hebel über Peter.</p>

<h2>Der Deal mit dem Broker</h2>

<p>Die zweite Staffel endete damit, dass Peter den Preis für seine Entscheidung erkennt: Er hat Monroe ermöglicht, seine gesamte Operation unsichtbar zu machen. Die dritte Staffel zeigt nun, wie diese Entscheidung Peters Leben prägt. Monroe, der im Verborgenen agiert, nutzt Peter als sein Werkzeug für eine größere Agenda.</p>

<p>In diesem Umfeld steht auch die Frage im Raum, ob die neue Präsidentin oder deren engster Kreis in Monroes Netzwerk verstrickt sein könnten – eine Bedrohung, die das gesamte Machtgefüge der USA ins Wanken bringen würde.</p>

<h2>Der Fall Jay Delgado</h2>

<p>Während dieses Schwebezustands erhält er einen Fall, der zunächst wie ein klassischer Personenschutz aussieht: <a href="/figur/jay-delgado-the-night-agent" class="text-blue-600 hover:text-blue-800 underline font-medium">Jay Delgado</a>, CEO eines großen Rüstungskonzerns, steht unter Mordverdacht. Die Beweislage ist erdrückend: Jay soll seine Verlobte Noor ermordet haben, nachdem diese ihn mutmaßlich betrogen hatte.</p>

<p>Jay hat sich an sie gewandt, um als Whistleblower Missstände seines Unternehmens offenzulegen – ein Schritt, der ihn in direkte Konfrontation mit mächtigen Wirtschaftsakteuren bringt. Doch bevor Catherine konkret werden kann, erschießt ein Attentäter Jay in unmittelbarer Nähe von Peter und seinem Team.</p>

<h2>Cyrus' tödlicher Verrat</h2>

<p>Damit rückt Jay vom mutmaßlichen Täter zum zentralen Baustein in einer Ermittlung, die weit über einen Eifersuchtsmord hinausgeht. Für Peter und sein Team entsteht daraus eine taktische Zwickmühle: Wer wollte verhindern, dass Jay aussagt – und wie hängt das mit den Personen zusammen, die Monroe schützen?</p>

<p>Der vermeintlich einzige Ausweg liegt in Cyrus, einem langjährigen Kontakt von Monroe, der bereit zu sein scheint, Informationen über dessen Organisation preiszugeben. Für Peter ist Cyrus die Chance, sich endlich aus Monroes Griff zu befreien und das gesamte Netzwerk zu Fall zu bringen.</p>

<p>Doch Cyrus spielt ein doppeltes Spiel. Als Peter und <a href="/figur/rose-larkin-the-night-agent" class="text-blue-600 hover:text-blue-800 underline font-medium">Rose</a> sich mit ihm treffen, eskaliert die Situation: Cyrus erschießt Peter und Rose, anstatt ihnen zu helfen. Obwohl beide überleben, wird klar, dass Monroe jeden Versuch, ihn zu enttarnen, im Keim ersticken wird – und dabei keine Rücksicht auf frühere Verbündete nimmt.</p>

<h2>Präsident Hagan unter Verdacht</h2>

<p>Am Ende von Staffel 3 wird Präsident Hagan durch eine Überwachungsaufnahme belastet, die ihn mit Monroe in Verbindung bringt. Das Video zeigt Hagan bei einem Treffen mit Monroe – ein Beweis, der nahelegt, dass der Präsident möglicherweise seit Jahren Teil von Monroes Netzwerk war.</p>

<p>Präsidentin <a href="/figur/michelle-travers-the-night-agent" class="text-blue-600 hover:text-blue-800 underline font-medium">Michelle Travers</a>, die Hagan als Vizepräsidentin abgelöst hat, steht nun vor der größten Krise ihrer Amtszeit: Soll sie ihren Vorgänger verhaften lassen – und damit einen politischen Tsunami auslösen, der das Vertrauen in das Amt des Präsidenten nachhaltig beschädigen würde?</p>

<h2>Mosleys zweifelhafte Rolle</h2>

<p>FBI-Agentin <a href="/figur/aiden-mosley-the-night-agent" class="text-blue-600 hover:text-blue-800 underline font-medium">Aiden Mosley</a> spielt eine zentrale, aber höchst zwielichtige Rolle in Staffel 3. Offiziell als Ermittlerin eingesetzt, liefert sie Peter immer wieder Hinweise, die zunächst hilfreich erscheinen – aber bei genauerem Hinsehen Peter in Richtungen lenken, die Monroe nützen.</p>

<p>Ob Mosley bewusst als Doppelspiel agiert oder selbst manipuliert wird, bleibt unklar. Ihre Präsenz wirft jedoch grundlegende Fragen auf: Wie tief ist Monroes Netzwerk in die US-Sicherheitsapparate eingedrungen?</p>

<h2>Ausblick auf Staffel 4</h2>

<p>Die Frage, ob Hagan tatsächlich verhaftet wird, könnte den Ausgangspunkt für Staffel 4 bilden. Eine Verhaftung würde zwar Gerechtigkeit symbolisieren, aber zugleich eine politische Destabilisierung auslösen, die Monroe möglicherweise in die Hände spielt.</p>

<p>Für Peter bedeutet das Ende von Staffel 3, dass der Kampf gegen Monroe nicht nur eine nachrichtendienstliche, sondern auch eine existenzielle Dimension annimmt: Monroe hat gezeigt, dass er bereit ist, jeden zu opfern – selbst seine eigenen Verbündeten. Staffel 4 muss klären, ob Peter sich aus dieser Spirale befreien kann, ohne dabei sein eigenes moralisches Fundament zu verlieren.</p>`;

  await prisma.articles.update({
    where: { slug },
    data: { contentHtml: newContent }
  });

  const h2Count = (newContent.match(/<h2/g) || []).length;
  console.log('✅ Artikel komplett neu strukturiert');
  console.log('📊 H2-Tags:', h2Count);
  console.log('');
  console.log('✅ Überschriften:');
  const headings = newContent.match(/<h2>([^<]+)<\/h2>/g);
  headings?.forEach(h => console.log('   -', h.replace(/<[^>]+>/g, '')));
}

fixArticleHeadings()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
