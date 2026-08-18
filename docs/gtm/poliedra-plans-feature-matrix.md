# POLIEDRA — Plans & Feature Matrix v0.1

Status: Product Owner proposal for validation before publication.

## Pricing architecture

### STANDARD — €49/month
Target: solo professional or very small studio.

Included:
- 1 owner/professional user;
- 1 collaborator seat;
- 1 location;
- client/patient registry;
- agenda;
- core professional/clinical record for selected vertical;
- basic service/treatment plans;
- documents and consent templates;
- basic payment tracking;
- basic dashboard;
- basic reminders;
- PDF/report generation;
- standard support;
- AI assistant: 100 standard interactions/month included.

Limits / exclusions:
- no advanced management-control suite;
- no CFO AI proactive monitoring;
- no advanced marketing automation;
- no voice-agent minutes included;
- no advanced multidisciplinary permissions;
- no multi-location management.

Suggested additional collaborator: €9/month.

### PRO — €99/month
Target: structured professional studio and small team. Recommended plan.

Included:
- 1 owner/admin + 5 collaborator seats;
- 1 location;
- everything in Standard;
- full profession-specific vertical;
- team management and role permissions supported by the vertical;
- advanced management control using POL-003 canonical metrics when released;
- KPI drill-down;
- advanced documents/reporting;
- CRM recalls and follow-up;
- workflow automation;
- supported integrations;
- CFO AI: 500 standard interactions/month included;
- proactive missing-data/anomaly prompts when released;
- basic marketing automation;
- priority support.

Suggested additional collaborator: €8/month.

### PREMIUM — €199/month
Target: multidisciplinary, multi-operator and growth-oriented studio.

Included:
- 1 owner/admin + 15 collaborator seats;
- up to 2 locations when multi-location capability is released;
- everything in Pro;
- advanced multidisciplinary permissions;
- owner/executive dashboard;
- advanced forecast/scenario analysis;
- advanced CRM/marketing automation;
- referral and sales-partner functionality where released;
- CFO AI: 2,000 standard interactions/month included;
- AI operational assistant allowance;
- 100 voice-agent minutes/month included after voice release;
- onboarding assistance;
- premium support target.

Suggested additional collaborator: €6/month.
Suggested additional location: €39/month.

## AI usage model
Do not expose raw model tokens to customers. Sell understandable usage units.

Define `AI interaction` as a bounded product action such as:
- summarize a record;
- draft a follow-up;
- explain a KPI;
- detect missing management data;
- prepare a standard report;
- answer an operational question.

Heavy operations may consume multiple interaction units. The UI must show remaining allowance and warn before paid overage.

Proposed overage packs:
- +250 AI interactions: €9;
- +1,000 AI interactions: €29;
- enterprise/high-volume: custom.

Exact unit economics must be validated against real model/API cost before publication.

## Voice AI model
Voice is usage-based because telephony and model costs vary.

After voice release:
- Standard: optional add-on only;
- Pro: optional add-on, no included minutes initially;
- Premium: 100 minutes/month included as launch hypothesis.

Proposed additional voice packs:
- 100 minutes: €19;
- 500 minutes: €79;
- 1,500 minutes: €199.

These are commercial hypotheses. Validate against actual telephony + speech + model cost and target gross margin before publication.

Voice agent capabilities roadmap:
1. answer/reception;
2. booking and rescheduling;
3. recall/reactivation;
4. lead qualification;
5. administrative FAQ;
6. payment/reminder routing where legally and operationally appropriate.

Clinical diagnosis/medical decision-making is not a voice-agent sales feature.

## Feature matrix

| Capability | Standard | Pro | Premium |
|---|---|---|---|
| Registry | Yes | Yes | Yes |
| Agenda | Yes | Yes | Yes |
| Base vertical record | Yes | Full | Full |
| Documents/consents | Base | Advanced | Advanced |
| PDF/reporting | Yes | Advanced | Advanced |
| Payment tracking | Base | Advanced | Advanced |
| Team seats included | 2 total | 6 total | 16 total |
| Role permissions | Base | Advanced | Advanced multidisciplinary |
| Management dashboard | Base | Pro | Executive |
| POL-003 canonical KPIs | Limited view | Full | Full + forecast |
| CFO AI | Limited | Yes | Advanced |
| CRM follow-up/recall | Base | Yes | Yes |
| Marketing automation | No | Base | Advanced |
| Voice AI | Add-on | Add-on | Allowance + add-on |
| Integrations | Essential | Supported | Supported + priority |
| Multi-location | No | No initially | Up to 2 when released |
| Onboarding | Self/guided | Guided | Assisted |
| Support | Standard | Priority | Premium |

## Vertical entitlement principle
Subscription plan and vertical are separate concepts.

A customer selects:
1. a commercial plan (Standard/Pro/Premium);
2. one primary vertical;
3. optional additional vertical capability where the studio is genuinely multidisciplinary.

Do not create separate copies of Poliedra per profession.

Proposed primary vertical included in every plan.
Additional specialized vertical module for the same studio: proposed €19/month each, only when it adds meaningful profession-specific workflow rather than simple user role access.

Example: a Physio studio with personal trainers and massage therapists should not automatically pay three vertical fees if those collaborators are part of the Physio multidisciplinary workflow. Charge an additional vertical only for a materially distinct workflow/business unit.

## Pilot pricing
First controlled cohort proposal:
- Standard Pilot: €39/month;
- Pro Pilot: €79/month;
- Premium Pilot: €149/month.

Conditions:
- limited number of pilot studios;
- structured feedback participation;
- pilot pricing locked for 12 months from activation;
- migration to then-current public pricing after the lock period with advance notice;
- no lifetime discount.

## Trial / demo policy
Recommended:
- solo: 14-day trial after guided setup;
- studio/team: demo first, then 14-day pilot/trial;
- no credit card required for initial controlled beta;
- once funnel is validated, test card-required vs no-card cohorts.

Trial activation event should be meaningful, not account creation. Proposed activation definition:
`studio configured + first real/synthetic client/patient + first appointment + first profession-specific workflow completed`.

## Annual billing
Do not lead with aggressive annual discounts at launch.

Initial proposal after paid pilot validation:
- monthly list price;
- annual prepay equivalent to 10 months (approximately 16.7% effective discount).

Pilot users should not stack pilot discount + annual discount unless unit economics explicitly permit it.

## Onboarding economics
Standard:
- included self/guided onboarding;
- optional assisted onboarding €49.

Pro:
- guided onboarding included for launch;
- data migration quoted separately when complex.

Premium:
- assisted onboarding included;
- complex historical data migration/custom integration quoted separately.

## Commission compatibility
Commercial commissions are calculated on net subscription revenue actually collected, excluding VAT, refunds, pass-through telephony/message costs and one-off third-party charges unless the partner agreement explicitly states otherwise.

This prevents sales commissions from consuming margin on variable-cost services.

## Upgrade triggers inside product
Suggest upgrade only when user encounters real value boundary:
- third collaborator on Standard;
- advanced KPI/CFO request;
- advanced role permissions;
- marketing automation;
- voice agent activation;
- second location;
- forecast/scenario planning.

Avoid arbitrary popups unrelated to workflow.

## Product Owner decisions still required
Before public pricing:
1. approve/change €49 / €99 / €199;
2. approve included seats 2 / 6 / 16 total;
3. approve collaborator overage €9 / €8 / €6;
4. approve AI allowances;
5. validate AI pack economics;
6. validate voice cost/minute and packs;
7. approve 12-month pilot price lock;
8. approve annual prepay discount;
9. decide whether Premium launches with 1 or 2 locations;
10. define VAT display policy for B2B pricing page.
