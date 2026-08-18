# POLIEDRA — Product Launch Pack

Status: commercial/product proposal. Pricing and commercial economics require Product Owner validation before publication.

## 1. Positioning
Poliedra is not positioned as a generic appointment book. It is an AI-native operating system for professionals and multidisciplinary studios, connecting:
- client/patient management;
- agenda and workflows;
- clinical/professional records;
- documents and consents;
- payments;
- management control;
- marketing/CRM;
- AI assistants and voice agents;
- profession-specific vertical modules.

Core promise:
`work -> relationship -> money -> intelligence`, inside one platform.

## 2. Initial target segments
### Wave 1 — launch/pilot priority
1. Physiotherapy and multidisciplinary rehab/wellness studios.
2. Dental/medical professional practices already matching the existing CORE.
3. Personal trainers/massage therapists working inside or alongside clinics.

### Wave 2
- psychologists;
- doctors/private specialists;
- dietitians/dietologists;
- naturopaths;
- beauty centers;
- hairdressers.

Beauty/hairdressing should reuse the same business/marketing/agenda engine but must not inherit clinical functionality that is irrelevant or inappropriate.

## 3. Proposed plans
These are launch hypotheses to validate, not final public prices.

### STANDARD — proposed €49/month
For solo professionals/small practices.

Includes:
- client/patient registry;
- agenda;
- basic documents;
- reminders;
- basic payments tracking;
- base professional vertical;
- basic dashboard;
- 1 primary user + limited collaborator support;
- standard support.

Not included by default:
- advanced management control;
- advanced marketing automation;
- advanced AI/voice usage;
- complex role-based teams;
- multi-location management.

### PRO — proposed €99/month
Primary recommended plan for structured practices.

Includes Standard plus:
- full vertical workflow;
- team/collaborator management;
- management control Pro;
- canonical KPIs when POL-003 is live;
- advanced documents/reporting;
- CRM/follow-up/recall;
- integrations enabled by supported connectors;
- CFO AI assistant allowance;
- advanced workflow automation;
- priority support.

### PREMIUM — proposed €199/month
For multidisciplinary or growth-oriented studios.

Includes Pro plus:
- advanced team roles/permissions;
- advanced management control and forecast;
- marketing automation suite;
- Sales/Referral functionality where relevant;
- advanced AI allowance;
- voice-agent features/allowance;
- multi-location readiness where supported;
- advanced owner dashboard;
- onboarding assistance;
- premium support/SLA target.

### Add-ons / usage-based components
Keep expensive variable-cost services outside unlimited base pricing when necessary:
- additional AI usage;
- voice minutes;
- messaging/SMS/WhatsApp provider costs;
- additional storage;
- additional locations;
- premium onboarding/data migration;
- third-party paid integrations.

Principle: do not sell unlimited usage where Poliedra bears unbounded API/telephony cost.

## 4. Launch pricing strategy
Recommended pilot structure:
- first pilot cohort: preferential founder/pilot price in exchange for structured feedback;
- lock pilot price for a defined period, not forever;
- no free lifetime plans;
- 14-day guided trial or demo-assisted activation rather than a completely unguided long free trial for complex studios;
- annual payment option with discount only after retention behavior is understood.

Possible pilot offer to validate:
- Standard €39 pilot;
- Pro €79 pilot;
- Premium €149 pilot;
for first validated cohort, followed by proposed list pricing €49/€99/€199.

## 5. Feature matrix principle
Every feature must belong to one of four layers:
1. CORE — shared by every compatible vertical;
2. VERTICAL — profession-specific workflow;
3. GROWTH — CRM, marketing, referral, sales;
4. INTELLIGENCE — CFO AI, operational AI, voice agents.

Avoid copying the same feature into multiple verticals. Vertical configuration should activate specialized workflows on the same core data model wherever possible.

## 6. Current / near-current product capabilities to sell carefully
Only market capabilities that have passed product/release gates.

Existing/advanced base includes or is being hardened around:
- patient/client records;
- agenda/workflows;
- treatment/service plans and payments;
- clinical/professional notes;
- documents/consents;
- management-control foundations;
- team users;
- Google Calendar related flows;
- communication workflows;
- physiotherapy baseline vertical;
- AI functionality already present in product;
- PDF/report generation;
- Supabase multi-tenant backend;
- Vercel delivery pipeline.

Security work POL-002A/POL-002B and financial source-of-truth POL-003 must determine which claims are safe for public launch.

## 7. Future/high-value features
- canonical management control and CFO AI;
- automated missing-data prompts;
- POS/payment connections: SumUp, Satispay, Flatpay, Revolut by supported integration path;
- accounting/commercialist integrations;
- Sistema TS opt-in workflows where legally/technically supported;
- radiology/software integrations;
- patient/client app;
- authorization/compliance workflows for clinics/polyclinics;
- advanced verticals;
- marketing automation;
- referral/partner sales module;
- AI voice reception;
- AI voice booking/rebooking;
- AI voice recall/reactivation;
- AI voice lead qualification;
- AI customer-care triage.

## 8. Demo structure — target 15 minutes
### Minute 0–2 — the problem
Show fragmentation: agenda, records, money, marketing, team.

### Minute 2–6 — operational workflow
Create/find client/patient -> appointment -> record/workflow -> document.

### Minute 6–9 — business layer
Show payments and management dashboard, clearly separating produced vs collected when canonical engine is available.

### Minute 9–12 — vertical differentiation
Show profession-specific workflow, starting with Physio clinic-ready when ready.

### Minute 12–14 — AI/growth
Show CFO AI / automation / marketing / voice roadmap only at the maturity level actually released.

### Minute 14–15 — close
Select plan -> onboarding -> activation date.

## 9. Onboarding
### Solo professional
Target onboarding: <30 minutes assisted, then self-service daily use.

### Studio/team
Target onboarding:
1. create studio;
2. select vertical;
3. configure services/pricing;
4. invite team;
5. assign roles;
6. import/create clients/patients;
7. configure agenda;
8. configure payments/costs;
9. activate templates;
10. guided first workflow.

Provide an onboarding checklist inside the product rather than relying on external PDF instructions.

## 10. Sales channels
Recommended initial channel mix:
- founder-led direct sales;
- referral/ambassador network;
- 3-person pilot commercial network on performance;
- professional associations/training networks where feasible;
- commercialists/consultants as referrers;
- suppliers/industry partners;
- inbound content/demo requests;
- later paid acquisition only after demo-to-paid conversion is measurable.

Do not scale paid ads before onboarding and retention are proven.

## 11. Commercial network — proposed economics
### Pilot sales partner
Compensation should reward paid, retained customers rather than raw leads.

Proposal to test:
- one-time commission: 20–30% of first-year net subscription revenue collected; OR
- recurring commission: 15–20% of net subscription revenue for 12 months.

Do not combine high upfront and high recurring commission without CAC/LTV evidence.

Commission payable only on collected subscription revenue and subject to cancellation/refund rules.

### Ambassador/referral
For professionals who introduce leads without running the sales process:
- fixed referral bounty after first paid period; or
- 10% recurring for 6–12 months.

## 12. Sales Partner Module — GTM-001
Poliedra should eventually track its own sales channel.

Required objects:
- partner/ambassador;
- referral code/link;
- lead source;
- lead owner;
- stage;
- demo date;
- trial;
- conversion;
- subscription plan;
- MRR/ARR generated;
- collected revenue;
- commission rule;
- accrued/paid commission;
- cancellation/churn;
- leaderboard.

This data must later consume canonical subscription revenue semantics, not invented client-side calculations.

## 13. Funnel
Canonical commercial funnel:
`LEAD -> QUALIFIED -> DEMO BOOKED -> DEMO COMPLETED -> TRIAL/PILOT -> PAID -> ACTIVE -> EXPANDED/CHURNED`

Minimum KPIs:
- leads by channel;
- demo booking rate;
- show rate;
- demo-to-trial;
- trial-to-paid;
- CAC;
- payback period;
- MRR/ARR;
- logo churn;
- revenue churn;
- expansion revenue;
- activation time;
- 30/60/90-day retention.

## 14. Launch gates
### Private beta
Allowed when:
- critical security P0 closed/tested;
- patient-files protected;
- core workflows stable enough for real use;
- support channel exists;
- rollback/recovery path exists.

### Paid pilot
Allowed when:
- beta users can complete daily workflow without developer intervention;
- billing/pricing contract is clear;
- onboarding reproducible;
- major product numbers are trustworthy enough for marketed claims;
- no known blocker security/privacy defect.

### Market-ready v1
Allowed when:
- POL-003 financial engine is stable for financial claims;
- automated quality gates exist;
- monitoring/backups are operational;
- at least one vertical has completed structured pilot validation;
- support/onboarding/sales kit are ready;
- deployment authority and rollback are documented.

## 15. Vertical launch priority
Recommended sequence:
1. Physio multidisciplinary studio — real pilot and strongest immediate validation path.
2. Dental/medical professional use — leverage existing platform maturity.
3. Personal trainer/massage — adjacent workflows to Physio.
4. Psychology/medical specialists/dietology.
5. Beauty centers and hairdressers using business/growth core with their own non-clinical vertical.

## 16. Marketing message pillars
1. `Tutto in un unico posto` — operational simplicity.
2. `Sai davvero cosa guadagni` — management control, only after POL-003 is validated.
3. `Il gestionale lavora con te` — AI/CFO/automation.
4. `Costruito per il tuo lavoro` — vertical workflows.
5. `Cresce con lo studio` — collaborators, roles, marketing and owner dashboard.

Avoid vague AI claims. Demonstrate an action and an outcome.

## 17. First launch assets
Before external sales scale, create:
- 15-minute master demo;
- 3-minute short demo;
- vertical one-pagers;
- pricing page;
- FAQ;
- objection-handling sheet;
- onboarding checklist;
- pilot agreement/commercial terms;
- sales partner agreement template reviewed legally;
- demo accounts with synthetic data;
- support escalation process;
- release notes/status communication.

## 18. First 30 customers strategy
Suggested composition:
- 5–10 structured pilot users through direct network;
- 5–10 ambassador/referral customers;
- 5–10 pilot sales-network customers;
- remaining customers from inbound/organic experiments.

Goal is not maximum registrations. Goal is repeatable activation + retention + paid conversion.

## 19. Product Owner decisions required before publication
- final price points;
- number of users included in each plan;
- AI/voice allowances;
- trial duration;
- annual discount;
- onboarding fee;
- commission model;
- refund/cancellation rules;
- which features are publicly marked `available`, `beta`, `coming soon`.
