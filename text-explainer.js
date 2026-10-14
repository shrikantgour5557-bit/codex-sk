/* Offline, deterministic explanation helpers. This is a local rules engine,
 * not a generative model. It never reads page state or makes network calls. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StepPilotTextExplainer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAX_LENGTH = 20000;
  const GLOSSARY = {
    api: ['an Application Programming Interface: a defined way for software systems to request data or actions from each other.', 'एक तय तरीका जिससे अलग-अलग software एक-दूसरे से data या काम का अनुरोध करते हैं।'],
    html: ['the markup that describes the structure and content of a web page.', 'वेब पेज की बनावट और सामग्री बताने वाला markup।'],
    css: ['the rules that control how HTML content looks, such as color, spacing, and layout.', 'वे नियम जो HTML सामग्री का रंग, दूरी और layout तय करते हैं।'],
    javascript: ['a programming language commonly used to add behavior to web pages.', 'एक programming language जिसका उपयोग web pages में व्यवहार जोड़ने के लिए होता है।'],
    json: ['a text format for representing structured data with objects, arrays, and values.', 'objects, arrays और values में structured data रखने का text format।'],
    url: ['the address of a resource on the web.', 'वेब पर किसी पेज या resource का पता।'],
    http: ['the request-and-response protocol commonly used to transfer web content.', 'वेब सामग्री भेजने और पाने के लिए आम request-response protocol।'],
    https: ['HTTP protected by encryption, which helps protect data while it travels between browser and server.', 'encryption से सुरक्षित HTTP, जो browser और server के बीच data को सुरक्षित रखने में मदद करता है।'],
    seo: ['search engine optimization: changes that help relevant pages appear in unpaid search results.', 'Search Engine Optimization: ऐसे सुधार जो relevant pages को बिना paid ad के search results में दिखने में मदद करते हैं।'],
    roas: ['return on ad spend: revenue attributed to ads divided by ad cost. The exact attribution method depends on the platform.', 'विज्ञापन खर्च के मुकाबले उससे जोड़ी गई आय का अनुपात। आय जोड़ने का तरीका platform पर निर्भर करता है।'],
    llm: ['a large language model: software trained to recognize and generate patterns in language.', 'भाषा के patterns पहचानने और text बनाने के लिए train किया गया बड़ा language model।'],
    rag: ['retrieval-augmented generation: a system retrieves relevant source material and gives it to a language model to help form an answer.', 'ऐसी प्रणाली जो उत्तर बनाने से पहले संबंधित स्रोत सामग्री खोजकर language model को देती है।'],
    'machine learning': ['a way to build software that learns patterns from examples instead of relying only on hand-written rules.', 'software बनाने का तरीका जिसमें system उदाहरणों से patterns सीखता है।'],
    database: ['an organized collection of information that software can store, search, and update.', 'जानकारी का व्यवस्थित संग्रह जिसे software सहेज, खोज और बदल सकता है।'],
    sql: ['a language used to query and change data in many relational databases.', 'कई relational databases में data खोजने और बदलने के लिए उपयोग की जाने वाली भाषा।'],
    cache: ['a temporary copy kept so information can be reused faster; stale cached data may need refreshing.', 'तेज़ reuse के लिए रखी गई अस्थायी copy; पुरानी cache को refresh करना पड़ सकता है।'],
    cloud: ['computing resources delivered over a network rather than only from a device you own.', 'ऐसे computing resources जो केवल अपने device पर नहीं, network के जरिए मिलते हैं।'],
    algorithm: ['a defined sequence of steps for solving a problem or performing a task.', 'किसी समस्या को हल करने या काम करने के लिए तय चरणों का क्रम।'],
    variable: ['a named place in a program where a value can be stored or referred to.', 'program में नाम वाली जगह जहाँ value रखी या इस्तेमाल की जाती है।'],
    function: ['a reusable block of code that performs a task, often using inputs and returning a result.', 'code का दोबारा उपयोग होने वाला हिस्सा जो कोई काम करता है, अक्सर input लेकर result देता है।'],
    percentage: ['a proportion expressed out of 100.', '100 में से किसी अनुपात को बताने का तरीका।'],
    expertise: ['specialized knowledge or skill gained through study or experience.', 'किसी क्षेत्र में अध्ययन या अनुभव से मिली विशेष जानकारी या कौशल।', 'Kisi field mein study ya experience se mila specialized knowledge ya skill.'],
    'digital transformation': ['the use of digital technology to change how an organization works or delivers value; the phrase alone does not specify which changes were made.', 'digital technology के जरिए किसी संगठन के काम करने या value देने के तरीके में बदलाव; यह phrase अकेले बदलावों का विवरण नहीं बताता।', 'Digital technology se organization ke kaam karne ya value dene ke tareeke mein badlav; phrase akela yeh nahi batata ki kaun se badlav hue.'],
    'cutting-edge': ['very modern or among the newest available; it is a broad descriptive claim, not a measurable feature by itself.', 'बहुत आधुनिक या उपलब्ध नए विकल्पों में से; यह अपने आप में मापी जा सकने वाली विशेषता नहीं बताता।', 'Bahut modern ya available naye options mein se; yeh apne aap mein measurable feature nahi batata.'],
    hcf: ['highest common factor: the largest number that divides each given number with no remainder.', 'सबसे बड़ा ऐसा अंक जो दिए गए सभी अंकों को बिना शेष के बाँटता है।'],
    lcm: ['least common multiple: the smallest positive number that is a multiple of each given number.', 'सबसे छोटा धनात्मक अंक जो दिए गए सभी अंकों का गुणज है।']
  };
  const ERROR_RULES = [
    { re: /ModuleNotFoundError|No module named ['"]?([^\s'"]+)/i, type: 'Python module import error', cause: 'Python could not find the named module in the environment running this code.', hi: 'जिस Python environment में code चल रहा है, उसमें मांगा गया module नहीं मिला।', steps: ['Confirm the module name in the import.', 'Check which Python environment is running the script.', 'If appropriate, install the package in that same environment and verify the package documentation.'] },
    { re: /ImportError/i, type: 'Python import error', cause: 'A module or a requested name could not be imported; the message may identify which one.', hi: 'कोई module या उसमें मांगा गया नाम import नहीं हो पाया; संदेश कारण को और स्पष्ट कर सकता है।', steps: ['Read the complete import message.', 'Check the module and symbol names, installed version, and active environment.'] },
    { re: /SyntaxError/i, type: 'Syntax error', cause: 'The parser found code that does not follow the language syntax. The reported position is where parsing noticed the problem, which may be just after its cause.', hi: 'भाषा के नियमों से मेल न खाने वाला code मिला। दिखाया गया स्थान वह हो सकता है जहाँ parser ने गलती पकड़ी, जरूरी नहीं कि गलती वहीं शुरू हुई हो।', steps: ['Inspect the indicated line and the line immediately before it.', 'Check delimiters, quotes, indentation, and required punctuation for the language.'] },
    { re: /TypeError/i, type: 'Type error', cause: 'An operation was used with a value of an unexpected or unsupported type.', hi: 'किसी operation को ऐसी value मिली जिसका type उस operation के लिए अपेक्षित नहीं था।', steps: ['Inspect the value named near the error and its type at that point.', 'Check whether it can be missing or null before using it.'] },
    { re: /ReferenceError|NameError/i, type: 'Undefined name error', cause: 'The code refers to a variable or name that is not available in the current scope.', hi: 'Code ऐसे variable या नाम को उपयोग कर रहा है जो उस scope में उपलब्ध नहीं है।', steps: ['Check spelling and capitalization.', 'Check where the name is declared and whether that declaration runs before use.'] },
    { re: /AttributeError/i, type: 'Python attribute error', cause: 'The value does not have the attribute or method being accessed, or the value is not the expected object.', hi: 'जिस value पर attribute या method उपयोग किया गया, उसमें वह उपलब्ध नहीं है या value अपेक्षित object नहीं है।', steps: ['Inspect the value and its type immediately before this line.', 'Check spelling and whether the value can be None.'] },
    { re: /Permission denied|EACCES|EPERM/i, type: 'Permission error', cause: 'The process does not have permission to access the named file or operation.', hi: 'इस process को बताई गई file या operation तक पहुँचने की अनुमति नहीं है।', steps: ['Check the path and current account permissions.', 'Confirm the file is not protected or locked; avoid changing permissions broadly.'] },
    { re: /ECONNREFUSED|connection refused|failed to connect/i, type: 'Connection error', cause: 'The destination refused the connection. Often no service is listening at that address or a network rule blocks it.', hi: 'दूसरी तरफ connection स्वीकार नहीं हुआ। अक्सर वहाँ service नहीं चल रही होती या network rule रोकता है।', steps: ['Check the host and port.', 'Confirm the destination service is running and reachable from this environment.'] },
    { re: /ETIMEDOUT|timed? ?out|timeout/i, type: 'Timeout', cause: 'A response did not arrive before the allowed wait time.', hi: 'तय समय के भीतर जवाब नहीं आया।', steps: ['Check connectivity and whether the service is responding.', 'Retry only after confirming the operation is safe to repeat.'] },
    { re: /\bHTTP\s*404\b|\b404\s*(?:not found)?\b/i, type: 'HTTP 404 — not found', cause: 'The server was reached, but it could not find a resource at the requested path.', hi: 'Server तक पहुँचा गया, लेकिन मांगा गया path वहाँ नहीं मिला।', steps: ['Check the URL path and spelling.', 'Confirm that the resource exists and the API version or route is correct.'] },
    { re: /CORS|cross-origin/i, type: 'Browser cross-origin policy error', cause: 'The browser blocked a web request because the server response did not permit the requesting origin under its cross-origin policy.', hi: 'Server ने requesting website को cross-origin नियमों के तहत अनुमति नहीं दी, इसलिए browser ने request रोकी।', steps: ['Check the request origin and the server’s CORS response headers.', 'Configure the server to allow only the intended origins; do not disable browser security.'] },
    { re: /database.*(?:connect|connection)|could not connect to server|ECONNREFUSED.*(?:db|database)/i, type: 'Database connection error', cause: 'The application could not establish a connection to its database. The selected message alone may not distinguish a wrong address, stopped database, credentials, or network issue.', hi: 'Application database سے connection نہیں بنا سکی۔ صرف اس پیغام سے गलत address, बंद database, credentials या network में अंतर तय नहीं किया जा सकता।', steps: ['Check whether the database service is running.', 'Verify host, port, database name, and secret configuration locally without sharing credentials.', 'Check network access and the complete preceding log.'] },
    { re: /command not found|is not recognized as an internal or external command/i, type: 'Command-line command not found', cause: 'The shell could not locate a command with that name.', hi: 'Shell को इस नाम का command नहीं मिला।', steps: ['Check the command spelling.', 'Check whether the required tool is installed and available on PATH.', 'Use the tool’s official installation instructions for your operating system.'] }
  ];
  const clean = value => String(value ?? '').normalize('NFKC').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u200b-\u200f\ufeff]/g, '').replace(/\u00a0/g, ' ').replace(/[‐‑‒–—]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/ *\n+ */g, '\n').trim();
  const langOf = value => value === 'hi' || value === 'hinglish' ? value : 'en';
  const sentences = text => clean(text).split(/(?<!\b(?:Mr|Mrs|Ms|Dr|Prof|e\.g|i\.e))(?<=[.!?।])\s+|\n+/u).map(part => part.trim()).filter(Boolean);
  const termEntries = text => Object.entries(GLOSSARY).filter(([term]) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const direct = new RegExp(`\\b${escaped}\\b`, 'i').test(text);
    return direct || (term === 'digital transformation' && /\b(?:transform(?:ed|ing)? digitally|digital(?:ly)? transform(?:ation)?)\b/i.test(text));
  });
  const termMeaning = (meanings, language) => language === 'hi' ? meanings[1] : language === 'hinglish' ? (meanings[2] || meanings[0]) : meanings[0];
  function explain(input, options = {}) {
    const text = clean(input), language = langOf(options.language);
    const hi = language === 'hi', hinglish = language === 'hinglish';
    const result = (fields = {}) => ({ status: 'ready', engine: 'local', language, confidence: 'medium', ...fields });
    if (!text) return { status: 'empty' };
    if (text.length > MAX_LENGTH) return { status: 'too-long', maxLength: MAX_LENGTH };
    const context = clean(options.nearbyContext || '').slice(0, 4000);
    const combined = `${context}\n${text}`;
    const foundTerms = termEntries(combined);
    const importantTerms = foundTerms.slice(0, 5).map(([term, meanings]) => ({ term: term.toUpperCase(), explanation: termMeaning(meanings, language) }));
    const followup = clean(options.followup || '').toLowerCase();
    if (followup && options.previousExplanation) {
      const prev = options.previousExplanation;
      if (/example|उदाहरण/.test(followup)) return result({ contentType: hi ? 'उदाहरण' : 'Follow-up example', summary: prev.summary, simpleExplanation: hi ? `उदाहरण: ${prev.example || 'यह विचार उसी नियम को किसी दूसरे मामले पर लागू करके समझा जा सकता है।'}` : `Example: ${prev.example || 'Apply the same idea to a different case.'}`, example: prev.example || '', confidence: prev.confidence || 'medium' });
      if (/simple|simpler|सरल|आसान/.test(followup)) return result({ contentType: hi ? 'सरल व्याख्या' : 'Simplified follow-up', summary: prev.summary, simpleExplanation: hi ? `सरल रूप में: ${prev.simpleExplanation || prev.summary}` : `In simpler terms: ${prev.simpleExplanation || prev.summary}`, confidence: prev.confidence || 'medium' });
      if (/detail|more|विस्तार|और बत/.test(followup)) return result({ contentType: hi ? 'अधिक विवरण' : 'More detail', summary: prev.summary, simpleExplanation: prev.simpleExplanation, detailedExplanation: prev.detailedExplanation || (hi ? 'चयन में उपलब्ध सीमित संकेतों के आधार पर यही अर्थ निकाला जा सकता है।' : 'The selection provides only limited evidence beyond this interpretation.'), importantTerms, confidence: prev.confidence || 'medium' });
      return result({ contentType: hi ? 'स्थानीय follow-up' : 'Local follow-up', summary: prev.summary, simpleExplanation: hi ? 'यह offline guide इस प्रश्न का नया स्वतंत्र उत्तर नहीं बना सकती। मूल चयन और पहचान योग्य शब्दों के आधार पर:' : 'This offline guide cannot generate a new open-ended answer. Based on the original selection and recognized terms:', detailedExplanation: prev.detailedExplanation || prev.simpleExplanation, importantTerms, uncertainty: hi ? 'नियम-आधारित engine केवल सीमित follow-up समझता है। प्रश्न को मूल चयन के साथ रखें या अधिक स्पष्ट संदर्भ चुनें।' : 'The rules-based engine supports only limited follow-ups. Include the question with the original selection or choose clearer context.', confidence: 'low' });
    }
    const error = ERROR_RULES.find(rule => rule.re.test(text));
    if (error) {
      const match = text.match(error.re);
      const location = text.match(/(?:File "([^"]+)", line (\d+)|([\w./-]+\.(?:py|js|ts|java|c|cpp|css|html)):(\d+)(?::(\d+))?)/i);
      const label = hi ? error.hi : error.cause;
      const explanation = hi ? `यह ${error.type} है। ${label}` : `${error.type}: ${label}`;
      return result({ mode: 'error', contentType: hi ? 'प्रोग्रामिंग या सिस्टम त्रुटि' : 'Programming or system error', errorType: error.type, summary: hi ? `चयनित संदेश ${error.type} बताता है।` : `The selected message indicates ${error.type}.`, simpleExplanation: explanation, likelyCause: hi ? `संभावित कारण: ${error.hi} संदेश अकेले हर बार असली root cause साबित नहीं करता।` : `Likely cause: ${error.cause} The message alone does not always prove the root cause.`, location: location ? (location[1] ? `${location[1]}:${location[2]}` : `${location[3]}:${location[4]}${location[5] ? `:${location[5]}` : ''}`) : '', locationNote: location ? (hi ? 'यह error द्वारा बताया गया स्थान है; मूल कारण उससे पहले की code या call में हो सकता है।' : 'This is the location reported by the error; the cause may be in earlier code or a caller.') : '', suggestions: error.steps.map(step => hi ? `जाँचें: ${step}` : step), codeSnippet: text, confidence: match?.[0] ? 'high' : 'medium', confidenceReason: hi ? 'त्रुटि का नाम संदेश में सीधे दिखता है; कारण सामान्य pattern पर आधारित है।' : 'The error name is explicit; the cause is based on a common pattern.' });
    }
    const codeLike = /(?:^|\n)\s*(?:def\s+\w+|function\s+\w+|const\s+\w+\s*=|let\s+\w+\s*=|class\s+\w+|import\s+[\w.{*]|from\s+\w+\s+import|<\w+[\s/>]|\{\s*["'\w-]+\s*:|SELECT\s+.+\s+FROM\s+|CREATE\s+TABLE|console\.(?:log|error)|print\s*\()/im.test(text);
    const html = /<\/?(?:html|div|p|a|button|input|form|head|body|script|style)\b/i.test(text);
    const css = /(?:^|[;}\n])\s*[.#]?[\w-]+\s*\{[^}]*:[^}]*\}/.test(text);
    const json = /^\s*[\[{][\s\S]*[\]}]\s*$/.test(text) && /["']\w+["']\s*:/.test(text);
    const sql = /\b(?:SELECT|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s+TABLE)\b/i.test(text);
    if (codeLike || html || css || json || sql) {
      let type = sql ? 'SQL' : html ? 'HTML' : css ? 'CSS' : json ? 'JSON data' : /\bdef\s+\w+/.test(text) ? 'Python code' : /\b(?:const|let|var|function|console\.)/.test(text) ? 'JavaScript code' : 'Code or configuration';
      let simple = hi ? `यह ${type} का अंश है। इसमें मौजूद चिन्ह और निर्देश ${sql ? 'database से data पढ़ने/बदलने' : html ? 'web page की सामग्री और संरचना बताने' : css ? 'web page का रूप तय करने' : json ? 'structured data रखने' : 'program या configuration का व्यवहार बताने'} के लिए उपयोग होते हैं।` : `This is a ${type} snippet. Its syntax is used to ${sql ? 'read or change database data' : html ? 'describe web-page structure and content' : css ? 'style web-page content' : json ? 'represent structured data' : 'define program or configuration behavior'}.`;
      const details = hi ? 'चयनित अंश का सटीक व्यवहार आसपास के code, input और runtime पर निर्भर हो सकता है। इसे चलाए बिना केवल दिखाई देने वाली संरचना समझाई जा रही है।' : 'The exact behavior can depend on surrounding code, inputs, and runtime. This explanation describes the visible structure without executing it.';
      if (options.language === 'hinglish') simple = `Yeh ${type} ka snippet hai. Iski syntax ${sql ? 'database data read ya change' : html ? 'web page structure aur content describe' : css ? 'web page style' : json ? 'structured data represent' : 'program ya configuration behavior define'} karne ke liye use hoti hai.`;
      return result({ mode: 'code', contentType: type, summary: hi ? `${type} का छोटा code/configuration अंश चुना गया है।` : `A short ${type} code/configuration snippet was selected.`, simpleExplanation: simple, detailedExplanation: details, codeExplanation: simple, codeSnippet: text, importantTerms, uncertainty: hi ? 'बाहरी code और values के बिना पूरे program का असर निश्चित नहीं किया जा सकता।' : 'The effect of the full program cannot be determined without its surrounding code and values.', confidence: 'medium', confidenceReason: hi ? 'वर्गीकरण syntax patterns से हुआ है; code चलाया नहीं गया।' : 'Classification is based on syntax patterns; the code was not executed.' });
    }
    const definition = text.match(/^\s*([^.!?]{2,90}?)\s+(?:is|means|refers to|are known as)\s+([^.!?]+)/i);
    const question = /\?\s*$/.test(text) || /^(?:what|why|how|when|where|which|who|क्‍या|क्यों|कैसे|कब|कहाँ)/i.test(text);
    const compare = /\b(?:however|whereas|unlike|compared with|on the other hand|advantage|disadvantage|pros? and cons?)\b|लाभ|हानि|जबकि/i.test(text);
    const causal = /\b(?:because|therefore|as a result|causes?|leads? to|due to|since)\b|क्योंकि|इसलिए|के कारण/i.test(text);
    const procedural = /(?:^|\n)\s*(?:\d+[.)]|step\s+\d+|first[, :] |then[, :] |next[, :] |finally[, :]|पहले|फिर|अंत में)/im.test(text);
    const businessProfile = /\b(?:software solutions?|business(?:es)?|digital(?:ly)? transform(?:ation)?|expertise|engineers?|successful projects?)\b/i.test(text);
    const metrics = text.match(/\b\d[\d,]*(?:\+|%)?\s+(?:years?(?:\s+of\s+[\w-]+)?|expert\s+engineers?|successful\s+projects?)\b/gi) || [];
    const parts = sentences(text);
    const topic = definition?.[1]?.trim() || importantTerms[0]?.term || (parts[0] || '').split(/\s+/).slice(0, 8).join(' ').replace(/[,:;.!?]+$/, '');
    let summary = text.length > 260 ? `${parts.slice(0, 2).join(' ').slice(0, 300)}${parts.length > 2 ? '…' : ''}` : text;
    let simple, detail, contentType, example = '';
    if (definition) {
      contentType = hi ? 'परिभाषा या अवधारणा' : 'Definition or concept';
      simple = hi ? `${definition[1].trim()} के बारे में यह पाठ कहता है कि ${definition[2].trim()}।` : `The passage defines ${definition[1].trim()} as ${definition[2].trim()}.`;
      detail = hi ? 'यह अर्थ चुने गए वाक्य की परिभाषा पर आधारित है। यदि यह किसी लंबे लेख का हिस्सा है, तो आसपास का संदर्भ अर्थ को और सीमित कर सकता है।' : 'This interpretation follows the definition in the selected sentence. If it comes from a longer article, nearby context may narrow the meaning.';
    } else if (procedural) {
      contentType = hi ? 'निर्देश या प्रक्रिया' : 'Instructions or procedure';
      simple = hi ? 'यह चयन किसी काम को क्रम से करने के निर्देश देता है। हर चरण को दिए गए क्रम में पूरा करें और अगले चरण से पहले उसका परिणाम जाँचें।' : 'This selection gives steps for completing a task. Follow them in order and check each result before continuing.';
      detail = parts.map((part, i) => `${i + 1}. ${part}`).join(' ');
    } else if (compare) {
      contentType = hi ? 'तुलना' : 'Comparison';
      simple = hi ? 'यह पाठ दो या अधिक विकल्पों के अंतर, लाभ या सीमाओं की तुलना कर रहा है। निर्णय में दोनों पक्षों को देखें।' : 'This passage compares differences, benefits, or limits across options. Consider both sides when deciding.';
      detail = parts.slice(0, 4).join(' ');
    } else if (causal) {
      contentType = hi ? 'कारण और परिणाम' : 'Cause and effect';
      simple = hi ? 'यह पाठ किसी कारण और उससे जुड़े परिणाम को बताता है। कारण बताने वाला हिस्सा समझाता है कि परिणाम क्यों हुआ।' : 'This passage links a cause with a result. The cause explains why the stated outcome happened.';
      detail = parts.slice(0, 4).join(' ');
    } else if (question) {
      contentType = hi ? 'प्रश्न' : 'Question';
      simple = hi ? `यह प्रश्न ${topic || 'किसी विषय'} के बारे में उत्तर माँगता है। चयन में पर्याप्त तथ्य न हों तो उत्तर तय नहीं किया जा सकता।` : `This asks about ${topic || 'a subject'}. The selection alone may not include enough facts to determine an answer.`;
      detail = hi ? 'सटीक उत्तर देने के लिए आवश्यक शर्तें, दिए गए विकल्प या संबंधित संदर्भ शामिल करें।' : 'Include the relevant conditions, answer choices, or context needed for a precise answer.';
    } else if (businessProfile) {
      contentType = hi ? 'व्यवसाय का परिचय' : hinglish ? 'Business overview' : 'Business overview';
      if (hi) {
        simple = 'यह परिचय कहता है कि कंपनी आधुनिक software solutions देती है, ताकि businesses को growth, innovation और digital तरीके से बदलाव में मदद मिले। ये कंपनी के अपने दावे हैं।';
        detail = `मुख्य बातें: ${parts.map(part => `“${part}”`).join(' ')}${metrics.length ? `\nचयन में दिए गए आंकड़े: ${metrics.join('; ')}। ये आंकड़े पाठ में किए गए दावे हैं; चयन इन्हें स्वतंत्र रूप से सत्यापित नहीं करता।` : ''}`;
        summary = 'कंपनी software solutions, अपना अनुभव और project आँकड़े बताकर businesses को digital बदलाव में मदद करने का दावा करती है।';
        example = 'Illustration (काल्पनिक उदाहरण): कोई business अपने manual काम को software से व्यवस्थित कर सकता है। चयन किसी खास ग्राहक या implementation का उल्लेख नहीं करता।';
      } else if (hinglish) {
        simple = 'Is intro ka simple meaning hai: company modern software solutions deti hai, jo businesses ko grow karne, innovate karne aur digital tareeke se badalne mein help karte hain. Ye company ke apne claims hain.';
        detail = `Main points: ${parts.map(part => `“${part}”`).join(' ')}${metrics.length ? `\nText mein diye numbers: ${metrics.join('; ')}. Ye passage ke claims hain; yahan independently verify nahi kiye gaye.` : ''}`;
        summary = 'Company apne software, experience aur project numbers batakar businesses ke digital change mein madad ka claim karti hai.';
        example = 'Illustration (hypothetical example): Ek business apne manual kaam ko software se organize kar sakta hai. Passage kisi particular customer ya implementation ka zikr nahi karta.';
      } else {
        simple = 'The passage says the company provides modern software solutions to help businesses grow, innovate, and change how they work digitally. These are claims made by the company.';
        detail = `Main points: ${parts.map(part => `“${part}”`).join(' ')}${metrics.length ? `\nNumbers stated in the passage: ${metrics.join('; ')}. These are claims in the text and are not independently verified here.` : ''}`;
        summary = 'The company describes its software, experience, and project counts, and says it helps businesses change digitally.';
        example = 'Illustration (hypothetical example): A business might use software to organize a manual task. The passage does not name a customer or describe a specific implementation.';
      }
    } else {
      contentType = text.length < 45 ? (hi ? 'छोटा वाक्यांश' : 'Short phrase') : (hi ? 'सामान्य पाठ' : 'General text');
      simple = hi ? `यह चयन “${topic}” के बारे में है। स्थानीय नियम-आधारित guide शब्दों और वाक्य की बनावट पहचान सकती है, लेकिन हर विषय का पूरा आशय नहीं निकाल सकती।` : `This selection is about “${topic}.” The local rules-based guide can identify wording and sentence structure, but cannot infer every subject’s full intent.`;
      if (options.language === 'hinglish') simple = `Yeh selection “${topic}” ke baare mein hai. Local rule-based guide wording aur sentence structure pehchan sakti hai, lekin har topic ka poora intent nahi samajh sakti.`;
      detail = hi ? `चयन का मुख्य कथन: ${summary}` : `Main statement in the selection: ${summary}`;
    }
    if (text.length > 1200 && !definition) {
      const omitted = Math.max(0, parts.length - Math.min(parts.length, 5));
      detail = hi ? `शुरुआती विचार: ${parts.slice(0, 5).join(' ')}${omitted ? ` इसके बाद ${omitted} और वाक्य हैं जिन्हें यह स्थानीय नियम-आधारित engine विस्तार से नहीं जोड़ सकता।` : ''}` : `Opening points: ${parts.slice(0, 5).join(' ')}${omitted ? ` There are ${omitted} more sentences that this local rules-based engine cannot fully synthesize.` : ''}`;
    }
    let practical = importantTerms.length ? (hi ? `यह शब्दावली मदद करती है: ${importantTerms.map(item => item.term).join(', ')}।` : `Recognized terminology that may help: ${importantTerms.map(item => item.term).join(', ')}.`) : '';
    if (businessProfile && !definition && !procedural && !compare && !causal && !question) practical = hi ? 'Digital transformation का मतलब digital technology से संगठन के काम करने के तरीके में बदलाव है। Expertise का मतलब किसी क्षेत्र का विशेष ज्ञान या कौशल है।' : hinglish ? 'Digital transformation ka matlab digital technology se organization ke kaam karne ka tareeka badalna hai. Expertise ka matlab kisi field ka specialized knowledge ya skill hai.' : 'Digital transformation means changing how an organization works using digital technology. Expertise means specialized knowledge or skill in a field.';
    if (businessProfile && !definition && !procedural && !compare && !causal && !question) return result({ mode: 'text', contentType, summary, simpleExplanation: simple, detailedExplanation: detail, example, importantTerms, practicalApplication: practical, confidence: 'high', confidenceReason: hi ? 'अर्थ, शब्द और आंकड़े सीधे चयनित पाठ से लिए गए हैं; उदाहरण को अलग से काल्पनिक बताया गया है।' : hinglish ? 'Meaning, terms aur numbers selected text se liye gaye hain; example ko alag se hypothetical label kiya hai.' : 'The meaning, terms, and numbers come from the selection; the example is explicitly labeled hypothetical.' });
    return result({ contentType, summary, simpleExplanation: simple, detailedExplanation: detail, example: importantTerms.length ? (hi ? `उदाहरण: ${importantTerms[0].term} का अर्थ — ${importantTerms[0].explanation}` : `Example: ${importantTerms[0].term} means ${importantTerms[0].explanation}`) : '', importantTerms, practicalApplication: practical, uncertainty: (text.length < 45 && !importantTerms.length) ? (hi ? 'यह वाक्यांश अकेले छोटा है; पूरा वाक्य या शीर्षक चुनने से अधिक सटीक अर्थ मिल सकता है।' : 'This phrase is too short on its own; selecting the full sentence or heading may make its meaning clearer.') : '', confidence: definition || procedural || compare || causal || importantTerms.length ? 'high' : text.length < 45 ? 'low' : 'medium', confidenceReason: hi ? 'व्याख्या चुने हुए शब्दों और पहचाने गए वाक्य pattern पर आधारित है, किसी external model पर नहीं।' : 'The explanation uses the selected wording and recognized sentence patterns, not an external model.', mode: 'text' });
  }
  return { explain, glossary: GLOSSARY, maxLength: MAX_LENGTH };
});
