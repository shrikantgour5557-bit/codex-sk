/* Reusable local semantic interpreter. It receives field metadata, never field values. */
(() => {
  const definitions = [
    ['title', /\b(title|salutation|honorific)\b|अभिवादन|उपाधि/i],
    ['firstName', /\b(first|given|forename)\s*name\b|पहला नाम/i],
    ['middleInitial', /\bmiddle\s*(initial|init\.?|letter)\b|\bmi\b/i],
    ['middleName', /\bmiddle\s*name\b/i],
    ['lastName', /\b(last|family|sur)\s*name\b|surname|उपनाम|अंतिम नाम/i],
    ['fullName', /\b(full|complete|legal)\s*name\b|\byour name\b|पूरा नाम/i],
    ['company', /\b(company|business|organization|organisation|employer|corporation)\b|कंपनी|व्यवसाय/i],
    ['position', /\b(position|job title|job role|occupation|designation|professional title)\b|पद|भूमिका/i],
    ['address1', /\b(address|street)\s*(line\s*)?1\b|\baddress line one\b/i],
    ['address2', /\b(address|street)\s*(line\s*)?2\b|\baddress line two\b/i],
    ['city', /\b(city|town)\b|शहर/i],
    ['state', /\b(state|province|region)\b|राज्य|प्रांत/i],
    ['country', /\b(country|nation)\b|देश/i],
    ['postal', /\b(zip|postal)\s*(code)?\b|\bpostcode\b|पिन कोड/i],
    ['dob', /\b(date of birth|birth date|dob)\b|जन्मतिथि/i],
    ['age', /\bage\b|उम्र|आयु/i],
    ['email', /\b(e-?mail)( address)?\b|ईमेल/i],
    ['phone', /\b(phone|mobile|telephone|tel number)\b|फ़ोन|मोबाइल/i],
    ['url', /\b(url|website|web address|landing page|destination link)\b|वेबसाइट/i],
    ['accountId', /\b(account|customer|client|user|record)\s*(id|number|code)\b/i],
    ['date', /\b(date|deadline|start day|end day)\b|तारीख़|तारीख/i],
    ['percent', /\b(percent(age)?|percentage|tax rate|conversion rate)\b|प्रतिशत/i],
    ['quantity', /\b(quantity|number of|count|units|seats|attendees|items)\b|मात्रा|संख्या/i],
    ['amount', /\b(amount|price|cost|budget|spend|salary|revenue|fee|payment amount)\b|राशि|बजट/i],
    ['file', /\b(upload|attach|attachment|file|document|resume|cv)\b|अपलोड|दस्तावेज़/i],
    ['keywords', /\b(keyword|search term|tag|topic)\b|कीवर्ड/i],
    ['description', /\b(description|message|comment|details|summary|reason|purpose|notes?)\b|विवरण|संदेश|कारण/i],
    ['choice', /\b(select|choose|category|type|status|method|option)\b|चुनें|विकल्प/i]
  ];
  const copy = {
    title: { en: 'Choose the title or salutation used before your name. Mr. means Mister; Ms. is a title for a woman that does not state marital status; Dr. means Doctor and should be used only when it applies to you.', hi: 'अपने नाम से पहले आने वाला title या salutation चुनें। Mr. का अर्थ Mister है; Ms. महिला के लिए ऐसा title है जो वैवाहिक स्थिति नहीं बताता; Dr. का अर्थ Doctor है और तभी चुनें जब यह आप पर लागू हो।' },
    firstName: { en: 'Enter your given (first) name only.', hi: 'यहाँ अपना पहला नाम लिखें।' },
    middleInitial: { en: 'Enter the first letter of your middle name, not the full middle name. Example: if your name is Rahul Singh Kumar and Singh is your middle name, enter S.', hi: 'यहाँ अपने middle name का पहला अक्षर लिखें, पूरा middle name नहीं। उदाहरण: Rahul Singh Kumar में Singh middle name है, तो S लिखें।' },
    middleName: { en: 'Enter your middle name in full. Do not shorten it to an initial unless the form asks for an initial.', hi: 'यहाँ अपना पूरा middle name लिखें। फ़ॉर्म initial न माँगे तो इसे एक अक्षर में छोटा न करें।' },
    lastName: { en: 'Enter your surname or family name.', hi: 'यहाँ अपना surname या family name लिखें।' },
    fullName: { en: 'Enter your complete name, including the name parts this form asks for.', hi: 'यहाँ अपना पूरा नाम लिखें, जिसमें इस फ़ॉर्म के अनुसार आपके नाम के सभी हिस्से हों।' },
    company: { en: 'Enter the name of your company or organization. If the field says legal or registered name, use the name on its official records.', hi: 'यहाँ अपनी company या organization का नाम लिखें। यदि legal या registered name माँगा है, तो आधिकारिक दस्तावेज़ वाला नाम लिखें।' },
    position: { en: 'Enter your job title or role, not the company name.', hi: 'यहाँ अपना job title या भूमिका लिखें, company का नाम नहीं।' },
    address1: { en: 'Enter the main street address for the home or office relevant to this form.', hi: 'यहाँ इस फ़ॉर्म से जुड़े घर या office का मुख्य street address लिखें।' },
    address2: { en: 'Enter extra address details such as an apartment, flat, unit, or suite number. If it is optional and does not apply, leave it blank.', hi: 'यहाँ अतिरिक्त पता लिखें, जैसे apartment, flat, unit या suite number। लागू न हो और optional हो, तो खाली छोड़ें।' },
    city: { en: 'Enter the name of your city or town.', hi: 'यहाँ अपने शहर का नाम लिखें।' },
    state: { en: 'Enter the state, province, or region requested by this address form.', hi: 'यहाँ पते के लिए माँगा गया state, province या region लिखें।' },
    country: { en: 'Select the country relevant to this address or application.', hi: 'यहाँ इस पते या आवेदन से जुड़ा देश चुनें।' },
    postal: { en: 'Enter the postal code for this address. In India this is commonly called a PIN code; follow the field’s shown format.', hi: 'यहाँ इस पते का postal code लिखें। भारत में इसे PIN code कहते हैं; फ़ील्ड में दिखा प्रारूप मानें।' },
    dob: { en: 'Enter or select your date of birth, not your current age.', hi: 'यहाँ अपनी जन्मतिथि डालें या चुनें, वर्तमान उम्र नहीं।' },
    age: { en: 'Enter your age as requested. Check whether the form asks for years or another unit.', hi: 'यहाँ माँगी गई उम्र लिखें। जाँचें कि फ़ॉर्म वर्ष या कोई दूसरी इकाई माँगता है।' },
    email: { en: 'Enter the email address requested by this form.', hi: 'यहाँ इस फ़ॉर्म में माँगा गया email address लिखें।' },
    phone: { en: 'Enter the phone number requested by this form. Follow any country-code or digit-format hint shown nearby.', hi: 'यहाँ इस फ़ॉर्म में माँगा गया phone number लिखें। पास में country code या अंकों का प्रारूप दिया हो तो उसे मानें।' },
    url: { en: 'Enter the full URL of the relevant webpage. Example only: https://example.com/page. Replace it with the actual working page requested by this form.', hi: 'यहाँ संबंधित webpage का पूरा URL लिखें। केवल उदाहरण: https://example.com/page। इसे अपने वास्तविक, चालू webpage से बदलें।' },
    accountId: { en: 'Enter the account or record identifier named by this form. If it is unclear which account or ID is meant, check the nearby instructions before entering it.', hi: 'यहाँ इस फ़ॉर्म में बताए account या record का पहचान नंबर लिखें। कौन-सा account या ID चाहिए यह स्पष्ट न हो, तो पहले पास के निर्देश देखें।' },
    date: { en: 'Enter or select the date named by this field. Use the date picker or the format shown on the page.', hi: 'यहाँ इस फ़ील्ड में बताई तारीख़ डालें या चुनें। Date picker या पेज पर दिखा प्रारूप मानें।' },
    percent: { en: 'Enter a percentage or rate, not a currency amount. Follow the unit and range shown by the page.', hi: 'यहाँ प्रतिशत या दर लिखें, मुद्रा राशि नहीं। पेज पर दिखाई इकाई और सीमा मानें।' },
    quantity: { en: 'Enter the count or quantity requested. Use the unit and range shown by the page.', hi: 'यहाँ माँगी गई संख्या या मात्रा लिखें। पेज पर दिखाई इकाई और सीमा मानें।' },
    amount: { en: 'Enter the amount requested. Check the visible currency and whether it is per item, per period, or a total; do not guess if those details are missing.', hi: 'यहाँ माँगी गई राशि लिखें। दिखाई गई मुद्रा और यह प्रति वस्तु, प्रति अवधि या कुल राशि है—जाँचें। जानकारी न हो तो अंदाज़ा न लगाएँ।' },
    file: { en: 'Choose the document or file requested by this form. Check the accepted file types and size limit shown on the page.', hi: 'यहाँ फ़ॉर्म में माँगा गया दस्तावेज़ या फ़ाइल चुनें। पेज पर बताए file type और size limit जाँचें।' },
    keywords: { en: 'Enter the keywords or topics requested by the nearby instructions, relevant to the product, service, or subject named there.', hi: 'पास के निर्देशों में माँगे गए keywords या विषय लिखें, जो बताए गए product, service या विषय से संबंधित हों।' },
    description: { en: 'Write the details, reason, or message requested by the field and its nearby prompt.', hi: 'फ़ील्ड और पास के प्रश्न में माँगा गया विवरण, कारण या संदेश लिखें।' },
    choice: { en: 'Select the option that matches your situation. If the options or their meaning are unclear, check the nearby explanation instead of guessing.', hi: 'अपनी स्थिति से मेल खाने वाला विकल्प चुनें। विकल्प का अर्थ स्पष्ट न हो, तो अंदाज़ा लगाने के बजाय पास का विवरण देखें।' }
  };
  const names = {
    en: { title:'Title / salutation', firstName:'First name', middleInitial:'Middle initial', middleName:'Middle name', lastName:'Last name', fullName:'Full name', company:'Company / organization', position:'Position / job title', address1:'Address line 1', address2:'Address line 2', city:'City', state:'State / province', country:'Country', postal:'ZIP / postal code', dob:'Date of birth', age:'Age', email:'Email', phone:'Phone', url:'Website URL', accountId:'Account identifier', date:'Date', percent:'Percentage', quantity:'Quantity', amount:'Amount', file:'File upload', keywords:'Keywords', description:'Description', choice:'Selection' },
    hi: { title:'Title / salutation', firstName:'First name', middleInitial:'Middle initial', middleName:'Middle name', lastName:'Last name', fullName:'Full name', company:'Company / organization', position:'Position / job title', address1:'Address line 1', address2:'Address line 2', city:'City', state:'State / province', country:'Country', postal:'ZIP / postal code', dob:'Date of birth', age:'Age', email:'Email', phone:'Phone', url:'Website URL', accountId:'Account identifier', date:'Date', percent:'Percentage', quantity:'Quantity', amount:'Amount', file:'File upload', keywords:'Keywords', description:'Description', choice:'Selection' }
  };
  const text = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[‐‑‒–—]/g, '-').replace(/\s+/g, ' ').trim();
  const tr = (lang, en, hi) => lang === 'hi' ? hi : en;
  const sensitivePattern = /password|passcode|one.?time.?code|\botp\b|credit.?card|card.?number|\bcvv\b|\bcvc\b|security.?code|social.?security|\bssn\b|national.?id|identity.?number|passport|driver.?s.?licen[sc]e|tax.?id|bank.?account|routing.?number|\biban\b|aadhaar/i;
  function cue(value) { return definitions.find(([id, pattern]) => pattern.test(text(value)))?.[0] || ''; }
  function interpretField(info = {}, language = 'en') {
    const lang = language === 'hi' ? 'hi' : 'en';
    const label = String(info.label || info.accessibleName || info.placeholder || info.title || '').trim();
    const context = [info.section, info.context, info.formContext, info.help].filter(Boolean).join(' · ');
    const related = String(info.related || '');
    const fieldType = text(info.inputType || info.type || info.role);
    const relatedText = text(related);
    const labelKey = cue(label);
    const contextKey = cue(context);
    const evidence = [label, info.placeholder, info.title, info.help, info.section, info.context, related, info.inputType, info.autocomplete].filter(Boolean);
    const sensitive = Boolean(info.sensitive) || fieldType === 'password' || sensitivePattern.test([label, info.name, info.id, info.autocomplete].join(' '));
    const result = {
      label: label || tr(lang, 'Unlabeled field', 'बिना लेबल वाला फ़ील्ड'),
      concept: null, meaning: '', what: '', why: '', example: '', format: '', requirement: '',
      confidence: 'low', evidence: evidence.slice(0, 8), reasoning: '',
      warning: '', next: '', needsClarification: false, sensitive
    };
    if (sensitive) {
      result.meaning = tr(lang, 'Sensitive information field', 'संवेदनशील जानकारी का फ़ील्ड');
      result.what = tr(lang, 'This appears to request sensitive information. StepPilot does not inspect its contents. Continue only if you trust the service and understand why it is needed.', 'यह संवेदनशील जानकारी माँगता दिखता है। StepPilot इसकी सामग्री नहीं पढ़ता। तभी आगे बढ़ें जब सेवा विश्वसनीय हो और कारण समझ में आता हो।');
      result.warning = tr(lang, 'Verify unclear identity, payment, legal, health, or financial requests with the service.', 'पहचान, भुगतान, कानूनी, स्वास्थ्य या वित्तीय जानकारी का अस्पष्ट अनुरोध सेवा से जाँचें।');
      result.confidence = 'high';
      return result;
    }

    let key = labelKey;
    let confidence = key ? 'high' : 'low';
    let reasoning = key ? tr(lang, 'The selected field label matches a known meaning.', 'चुने गए फ़ील्ड का लेबल पहचाने गए अर्थ से मेल खाता है।') : '';

    // "Title" is resolved only when adjacent fields provide useful evidence.
    if (/^(title|salutation|honorific)$/.test(text(label))) {
      const people = /\b(first name|middle name|middle initial|last name|surname|full name)\b/i.test(relatedText);
      const work = /\b(position|job|employment|career|work|department|employer|company)\b/i.test(relatedText + ' ' + text(context));
      const document = /\b(document|article|page|record|product)\b/i.test(text(context));
      if (people && !work && !document) {
        key = 'title'; confidence = 'high';
        reasoning = tr(lang, 'Nearby first/middle/last-name fields show this is a personal salutation.', 'पास के first/middle/last name फ़ील्ड बताते हैं कि यह व्यक्ति का salutation है।');
      } else if (work && !people && !document) {
        key = 'position'; confidence = 'moderate';
        reasoning = tr(lang, 'Nearby work or company fields suggest this means a job title.', 'पास के काम या company फ़ील्ड से job title का संकेत मिलता है।');
      } else if (document && !people && !work) {
        key = 'description'; confidence = 'moderate';
        reasoning = tr(lang, 'The surrounding document context suggests a document or item title.', 'आसपास का document context किसी दस्तावेज़ या item के title का संकेत देता है।');
      } else {
        key = ''; confidence = 'low';
        reasoning = tr(lang, '“Title” may mean a salutation, job title, or document title; nearby fields do not distinguish them.', '“Title” का अर्थ salutation, job title या document title हो सकता है; पास के फ़ील्ड अंतर स्पष्ट नहीं करते।');
      }
    }
    if (!key && contextKey) {
      key = contextKey; confidence = 'moderate';
      reasoning = tr(lang, 'The label is unfamiliar, but nearby section or help text points to this meaning.', 'लेबल अपरिचित है, लेकिन पास का अनुभाग या सहायता-पाठ इस अर्थ का संकेत देता है।');
    }
    if (!key && fieldType === 'email') { key = 'email'; confidence = 'high'; reasoning = tr(lang, 'The email input type identifies the expected format.', 'Email input type अपेक्षित प्रारूप बताता है।'); }
    if (!key && fieldType === 'url') { key = 'url'; confidence = 'high'; reasoning = tr(lang, 'The URL input type identifies the expected format.', 'URL input type अपेक्षित प्रारूप बताता है।'); }
    if (!key && fieldType === 'tel') { key = 'phone'; confidence = 'high'; reasoning = tr(lang, 'The telephone input type identifies the expected information.', 'Telephone input type माँगी गई जानकारी बताता है।'); }
    if (!key && fieldType === 'date') { key = 'date'; confidence = 'high'; reasoning = tr(lang, 'The date input type identifies the expected information.', 'Date input type माँगी गई जानकारी बताता है।'); }
    if (!key && fieldType === 'file') { key = 'file'; confidence = label ? 'moderate' : 'low'; }
    if (!key && (info.tagName === 'SELECT' || ['select','combobox','radio','checkbox','switch'].includes(fieldType))) { key = 'choice'; confidence = label ? 'moderate' : 'low'; }

    const placeholderKey = cue(info.placeholder);
    const titleKey = cue(info.title);
    const helperKey = cue(info.help);
    const conflicting = Boolean(info.conflict) || (labelKey && [placeholderKey, titleKey, helperKey].some(other => other && other !== labelKey));
    if (conflicting) {
      result.meaning = names[lang][labelKey] || label;
      result.what = tr(lang, 'The field label and another hint point to different things. The label suggests ' + result.meaning + ', but the visible hints conflict.', 'फ़ील्ड का लेबल और दूसरा संकेत अलग अर्थ बताते हैं। लेबल ' + result.meaning + ' बताता है, लेकिन दिखाई संकेत मेल नहीं खाते।');
      result.confidence = 'low';
      result.reasoning = tr(lang, 'Conflicting label and placeholder/title evidence.', 'लेबल और placeholder/title के संकेत आपस में टकराते हैं।');
      result.warning = tr(lang, 'Check the surrounding instructions or ask the form owner before entering information.', 'जानकारी डालने से पहले पास के निर्देश देखें या फ़ॉर्म संचालक से पूछें।');
      result.next = result.warning;
      result.needsClarification = true;
      return result;
    }
    if (!key) {
      result.meaning = tr(lang, 'Unclear field meaning', 'फ़ील्ड का अर्थ स्पष्ट नहीं');
      if (reasoning && /title/i.test(label)) {
        result.meaning = tr(lang, 'Possibly a salutation or another kind of title', 'संभवतः salutation या किसी अन्य प्रकार का title');
        result.what = tr(lang, '“Title” could mean a personal salutation (such as Mr. or Ms.), a job title, or a document/item title. The nearby fields do not make the intended meaning clear.', '“Title” का अर्थ व्यक्ति का salutation (जैसे Mr. या Ms.), job title या दस्तावेज़/item का title हो सकता है। पास के फ़ील्ड से सही अर्थ स्पष्ट नहीं है।');
        result.warning = tr(lang, 'Check the section heading or ask the form owner which kind of title is requested.', 'अनुभाग का शीर्षक देखें या फ़ॉर्म संचालक से पूछें कि किस प्रकार का title चाहिए।');
      } else result.what = label
        ? tr(lang, 'The label “' + label + '” is not specific enough to identify the information requested.', '“' + label + '” लेबल से माँगी गई जानकारी स्पष्ट नहीं होती।')
        : tr(lang, 'No label or nearby instruction identifies what belongs in this field.', 'कोई लेबल या पास का निर्देश नहीं बताता कि इस फ़ील्ड में क्या भरें।');
      result.reasoning = reasoning || tr(lang, 'Available field and form clues do not support a reliable interpretation.', 'फ़ील्ड और फ़ॉर्म के उपलब्ध संकेत भरोसेमंद अर्थ नहीं बताते।');
      if (!result.warning) result.warning = tr(lang, 'Check the field instructions or ask the form owner. Do not share sensitive details to clarify it.', 'फ़ील्ड के निर्देश देखें या फ़ॉर्म संचालक से पूछें। स्पष्ट करने के लिए संवेदनशील जानकारी साझा न करें।');
      result.next = result.warning;
      result.needsClarification = true;
      result.requirement = info.required ? tr(lang,'Marked required by the page.','पेज इसे आवश्यक बताता है।') : info.optional ? tr(lang,'Marked optional by the page.','पेज इसे वैकल्पिक बताता है।') : '';
      return result;
    }

    result.meaning = names[lang][key];
    result.concept = key;
    result.what = copy[key][lang];
    if (confidence === 'moderate') result.what = tr(lang, 'Likely: ', 'संभावित अर्थ: ') + result.what;
    result.confidence = confidence;
    result.reasoning = reasoning;
    result.example = examples(key, lang);
    result.format = formatFor(key, lang, info);
    result.why = whyFor(key, lang);
    result.requirement = info.required ? tr(lang, 'Required by the page.', 'पेज के अनुसार आवश्यक।') : info.optional ? tr(lang, 'Optional according to the page; leave blank if it does not apply.', 'पेज के अनुसार optional; लागू न हो तो खाली छोड़ें।') : '';
    if (['dob','age','accountId','amount','postal'].includes(key)) result.warning = tr(lang, 'Use accurate information and follow the service’s visible instructions.', 'सही जानकारी दें और सेवा के दिखाई निर्देश मानें।');
    if (confidence === 'low') {
      result.warning = tr(lang, 'This is only a likely interpretation; check the section instructions before continuing.', 'यह केवल संभावित अर्थ है; आगे बढ़ने से पहले अनुभाग के निर्देश जाँचें।');
      result.next = result.warning;
      result.needsClarification = true;
    }
    return result;
  }
  function examples(key, lang) {
    const values = {
      title:['Mr.','Mr.'], firstName:['Rahul','Rahul'], middleInitial:['S','S'], middleName:['Singh','Singh'], lastName:['Sharma','Sharma'], fullName:['Rahul Singh Sharma','Rahul Singh Sharma'],
      company:['ABC Technologies','ABC Technologies'], position:['Digital Marketing Intern','Digital Marketing Intern'], address1:['42 Example Street','42 Example Street'], address2:['Flat 4B','Flat 4B'], city:['Ahmedabad','Ahmedabad'], state:['Gujarat','Gujarat'], country:['India','India'], postal:['380001 (fictional format example)','380001 (केवल काल्पनिक प्रारूप उदाहरण)'],
      email:['person@example.com','person@example.com'], phone:['+1 202 555 0147','+1 202 555 0147'], url:['https://example.com/page','https://example.com/page'], accountId:['Example ID: 000123','उदाहरण ID: 000123'],
      percent:['10%','10%'], quantity:['3','3'], amount:['Example amount: 100 (currency not specified)','उदाहरण राशि: 100 (मुद्रा निर्दिष्ट नहीं)']
    };
    if (['date','dob','age','file','choice','description','keywords'].includes(key)) return '';
    return values[key] ? tr(lang, values[key][0], values[key][1]) : '';
  }
  function whyFor(key, lang) {
    const reasons = {
      title:['It helps the form address or categorize the person appropriately.','इससे फ़ॉर्म व्यक्ति को सही तरह संबोधित या वर्गीकृत कर पाता है।'],
      firstName:['It helps identify and address the person.','इससे व्यक्ति की पहचान और सही संबोधन में मदद मिलती है।'],
      middleInitial:['It distinguishes people who share similar names.','एक जैसे नाम वाले लोगों में अंतर करने में मदद मिलती है।'],
      middleName:['It helps identify the person when their full name is needed.','पूरा नाम आवश्यक होने पर व्यक्ति की पहचान में मदद मिलती है।'],
      lastName:['It helps identify the person and distinguish them from others.','व्यक्ति की पहचान और दूसरों से अंतर करने में मदद मिलती है।'],
      fullName:['The form needs the complete name for the purpose described on the page.','पेज पर बताए उद्देश्य के लिए पूरा नाम माँगा गया है।'],
      company:['It identifies the organization connected with this request or account.','इससे अनुरोध या खाते से जुड़ी संस्था की पहचान होती है।'],
      position:['It describes your role in a work or organization context.','यह काम या संस्था में आपकी भूमिका बताता है।'],
      address1:['It identifies the main delivery, residence, or business location requested by the form.','यह फ़ॉर्म में माँगी गई मुख्य delivery, घर या business location बताता है।'],
      address2:['It adds detail that helps distinguish a specific unit or suite.','इससे किसी खास unit या suite की पहचान में मदद मिलती है।'],
      city:['It identifies the city for the address or location.','इससे पते या स्थान का शहर पता चलता है।'],
      state:['It narrows the address or location to a state or province.','इससे पते या स्थान का state या province पता चलता है।'],
      country:['It identifies the country relevant to the request.','इससे अनुरोध से जुड़ा देश पता चलता है।'],
      postal:['It helps route mail or verify an address area.','इससे डाक पहुँचाने या पते के क्षेत्र की पुष्टि में मदद मिलती है।'],
      dob:['The form may need the birth date for the purpose stated by the service.','सेवा के बताए उद्देश्य के लिए जन्मतिथि आवश्यक हो सकती है।'],
      age:['The form may need age for eligibility or grouping as stated on the page.','पेज पर बताए पात्रता या वर्गीकरण के लिए उम्र माँगी जा सकती है।'],
      email:['The service may use it for replies or account messages, as described on the page.','पेज के अनुसार सेवा इसका उपयोग जवाब या खाते के संदेशों के लिए कर सकती है।'],
      phone:['The service may use it to contact you if its instructions say so.','निर्देश दिए हों तो सेवा इससे आपसे संपर्क कर सकती है।'],
      url:['It directs visitors or the service to the relevant webpage.','इससे visitor या सेवा संबंधित webpage तक पहुँचती है।'],
      accountId:['It helps match this request to the correct account or record.','इससे अनुरोध सही account या record से जुड़ता है।'],
      date:['It sets the date relevant to this request.','इससे अनुरोध से जुड़ी तारीख़ तय होती है।'],
      percent:['It records a rate or share in percentage terms.','इससे दर या हिस्सा प्रतिशत में दर्ज होता है।'],
      quantity:['It records how many units or people are involved.','इससे संबंधित इकाइयों या लोगों की संख्या दर्ज होती है।'],
      amount:['It records the financial amount relevant to the request.','इससे अनुरोध से जुड़ी वित्तीय राशि दर्ज होती है।'],
      file:['It attaches the document requested by the form.','इससे फ़ॉर्म में माँगा गया दस्तावेज़ जुड़ता है।'],
      keywords:['It helps describe or find the subject named by the form.','इससे फ़ॉर्म का विषय बताने या खोजने में मदद मिलती है।'],
      description:['It gives the recipient context about your request.','इससे प्राप्तकर्ता को आपके अनुरोध का संदर्भ मिलता है।'],
      choice:['It records which available option applies to you.','इससे लागू विकल्प दर्ज होता है।']
    };
    const pair = reasons[key];
    return pair ? tr(lang, pair[0], pair[1]) : '';
  }
  function formatFor(key, lang, info) {
    const parts = [];
    if (info.help) parts.push(info.help);
    if (info.maxLength) parts.push(tr(lang, 'Maximum ' + info.maxLength + ' characters.', 'अधिकतम ' + info.maxLength + ' अक्षर।'));
    if (info.min || info.max) parts.push(tr(lang, 'Visible range: ', 'दिखाई सीमा: ') + (info.min || '…') + '–' + (info.max || '…') + '.');
    if (info.step && info.step !== 'any') parts.push(tr(lang, 'Step: ', 'कदम: ') + info.step + '.');
    if (info.accept) parts.push(tr(lang, 'Accepted file types: ', 'स्वीकृत file type: ') + info.accept + '.');
    if (info.options?.length) parts.push(tr(lang, 'Available choices: ', 'उपलब्ध विकल्प: ') + info.options.join(', ') + '.');
    if (key === 'date' || key === 'dob') parts.push(tr(lang, 'Use the date picker or the format shown by the field.', 'Date picker या फ़ील्ड में दिखा प्रारूप उपयोग करें।'));
    if (key === 'postal') parts.push(tr(lang, 'Use the country-specific postal format shown by the form.', 'फ़ॉर्म में दिखा देश-विशिष्ट postal format मानें।'));
    if (key === 'middleInitial') parts.push(tr(lang, 'Enter one letter unless the page shows a different limit.', 'पेज अलग सीमा न बताए तो एक अक्षर लिखें।'));
    return [...new Set(parts.filter(Boolean))].join(' ');
  }
  const api = { interpretField, definitions };
  globalThis.StepPilotGuidance = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
