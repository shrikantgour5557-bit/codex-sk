# FreeAdSpace User Flows

## Visitor flow
1. Visitor lands on homepage and uses search/categories.
2. Visitor opens ad detail page.
3. CTA click routes to advertiser link/contact.

## User onboarding flow
1. User registers account.
2. Verification email is sent.
3. User verifies email and signs in.
4. User sees dashboard and posting limits.

## Ad posting flow
1. User clicks "Post New Ad".
2. Inputs title, description, category, image, external link.
3. Selects plan: FREE or paid upgrade.
4. System checks posting limit and spam risk.
5. Ad status set to `PENDING` for moderation.
6. Admin approves/rejects ad.
7. Approved ad appears in latest/featured lists.

## Admin moderation flow
1. Admin opens pending queue.
2. Reviews ad content + spam indicators.
3. Approves or rejects with reason.
4. Optional user action: warning, temporary block, or permanent block.

## Analytics flow
1. Ad detail page hit triggers `VIEW` event.
2. CTA button click triggers `CLICK` event.
3. Event pipeline updates ad_metrics table.
4. Dashboard displays view count, click count, and CTR.
