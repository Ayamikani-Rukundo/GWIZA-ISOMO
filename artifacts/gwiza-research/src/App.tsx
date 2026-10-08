import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { Route, Switch, Link, useLocation } from 'wouter';
import { ArrowDown, ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, CircleHelp, Download, LockKeyhole, LogOut, Menu, ShieldCheck, Trash2, Users, X } from 'lucide-react';
import { getGetAdminOverviewQueryKey, getGetAdminSessionQueryKey, getHealthCheckQueryKey, getListAdminSubmissionsQueryKey, getListQualitativeResponsesQueryKey, getExportSubmissionsCsvQueryKey, useAdminLogin, useAdminLogout, useCreateSurveySubmission, useDeleteAdminSubmission, useExportSubmissionsCsv, useGetAdminOverview, useGetAdminSession, useHealthCheck, useListAdminSubmissions, useListQualitativeResponses } from '@workspace/api-client-react';
import type { AdminOverview, RespondentType } from '@workspace/api-client-react';
import NotFound from '@/pages/not-found';
import './index.css';

const qc = new QueryClient();
const identities: Record<RespondentType, { title: string; subtitle: string; route: string; mark: string }> = {
  student: { title: 'Secondary student', subtitle: 'Share what student life and support feel like from your perspective.', route: '/survey/student', mark: '01' },
  school: { title: 'Teacher or school staff', subtitle: 'Tell us what schools notice and what support is available.', route: '/survey/school', mark: '02' },
  professional: { title: 'Relevant professional', subtitle: 'Offer a wider view of adolescent support and access.', route: '/survey/professional', mark: '03' },
  other: { title: 'Another perspective', subtitle: 'For caregivers, youth workers, researchers and community voices.', route: '/survey/other', mark: '04' },
};
const typeName: Record<RespondentType, string> = { student: 'Student', school: 'School staff', professional: 'Professional', other: 'Other' };
function Brand({ inverse = false }: { inverse?: boolean }) {
  return <Link href="/" className={`brand ${inverse ? 'brand-inverse' : ''}`} data-testid="link-gwiza-home"><span className="brand-symbol" aria-hidden="true"><i/><i/><i/></span><span>GWIZA<small>RESEARCH</small></span></Link>;
}
function Header({ admin = false }: { admin?: boolean }) {
  const [open, setOpen] = useState(false);
  return <header className="topbar"><div className="topbar-inner"><Brand/><nav className={`topnav ${open ? 'nav-open' : ''}`} aria-label="Main navigation"><Link href="/survey">Take part</Link><a href="/#about">About the research</a><Link href={admin ? '/admin' : '/admin/login'}>{admin ? 'Research workspace' : 'Research team'}</Link></nav><button className="menu-toggle" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(!open)} data-testid="button-menu">{open ? <X/> : <Menu/>}</button></div></header>;
}
function Notice({ compact = false }: { compact?: boolean }) {
  return <div className={`notice ${compact ? 'notice-compact' : ''}`}><ShieldCheck size={19}/><p><strong>Research only.</strong> This survey is not a diagnosis or treatment service. Please do not include your name or details that identify you.</p></div>;
}
function RespondentCards() {
  return <div className="respondent-grid">{(Object.keys(identities) as RespondentType[]).map((type) => <Link key={type} href={identities[type].route} className="respondent-card" data-testid={`link-survey-${type}`}><span className="card-count">{identities[type].mark}</span><span className="card-arrow"><ArrowRight size={18}/></span><h3>{identities[type].title}</h3><p>{identities[type].subtitle}</p></Link>)}</div>;
}
function Home() {
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey() } });
  return <><Header/><main><section className="hero-wrap"><div className="hero-copy"><p className="eyebrow"><span className="eyebrow-dot"/>A listening project across Rwanda</p><h1 className="serif">Understanding student wellbeing<span className="title-line">starts by listening.</span></h1><p className="hero-lede">We’re learning what secondary-school students experience, what support is already there, and what could make a real difference.</p><div className="hero-actions"><Link className="button button-primary" href="/survey">Take the research survey <ArrowRight size={17}/></Link><a className="text-link" href="#about">Learn about the project <ArrowDown size={16}/></a></div><div className="privacy-note"><LockKeyhole size={16}/><span>Anonymous by design. No names, phone numbers or exact school details.</span></div></div><div className="hero-art" aria-label="Illustration of connected people and support"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-center"><div className="art-mark"><span/><span/><span/></div><p>listen<br/>understand<br/>learn</p></div><div className="art-node node-one"><span className="node-person">S</span><small>student<br/>experience</small></div><div className="art-node node-two"><span className="node-person node-blue">↗</span><small>available<br/>support</small></div><div className="art-node node-three"><span className="node-person node-sage">+</span><small>what could<br/>change</small></div><div className="art-caption">A better picture begins<br/>with many perspectives.</div></div></section><section className="research-strip" id="about"><div><span className="section-index">01 / THE QUESTION</span><h2 className="serif">What support is here?<br/><em>What’s still missing?</em></h2></div><div className="strip-copy"><p>Gwiza Startup is conducting action research on the mental-health support gap among secondary-school students in Rwanda.</p><p>We’re not here to assume what the answer should be. We want to understand the everyday experience first — from students and the people around them.</p><a className="text-link" href="/survey">Add your perspective <ArrowRight size={16}/></a></div></section><section className="participate-section"><div className="section-heading"><span className="section-index">02 / TAKE PART</span><h2 className="serif">A useful picture needs<br/>more than one view.</h2><p>Choose the perspective that fits you. Most questions are optional, and you can skip anything you would rather not answer.</p></div><RespondentCards/></section><section className="method-section"><div className="method-symbol" aria-hidden="true"><span/><span/><span/></div><div><span className="section-index">HOW WE’RE APPROACHING THIS</span><h2 className="serif">Problem first.<br/>Possibilities later.</h2></div><p>We ask about experiences, current support and what may be missing before exploring possible solutions. Technology is one question among many — not an assumption.</p></section><section className="closing-note"><div><span className="section-index">A NOTE ON PRIVACY</span><h2 className="serif">Your voice, without<br/>your identity.</h2></div><p>We do not ask for your name, exact school or contact details. In open responses, please avoid sharing information that could identify you or someone else.</p></section></main><Footer health={health.isSuccess ? 'online' : health.isError ? 'offline' : 'checking'}/></>;
}
function Footer({ health }: { health?: 'online' | 'offline' | 'checking' }) {
  return <footer className="footer"><Brand/><div><span>GWIZA STARTUP · ACTION RESEARCH</span><span>This survey is voluntary and for research purposes only.</span></div>{health && <span className="health-status"><i className={health === 'online' ? '' : health === 'offline' ? 'health-offline' : 'health-checking'}/>{health === 'online' ? 'Research service available' : health === 'offline' ? 'Research service connection unavailable' : 'Checking research service'}</span>}</footer>;
}
function ChooseSurvey() {
  return <><Header/><main className="subpage"><div className="page-kicker"><Link href="/" className="back-link"><ArrowLeft size={16}/> Back to project</Link><span>PARTICIPANT PATHWAYS</span></div><div className="choice-intro"><span className="section-index">YOUR PERSPECTIVE MATTERS</span><h1 className="serif">Who are you joining<br/>the conversation as?</h1><p>Choose the closest fit. Each questionnaire is short and designed for your perspective.</p></div><RespondentCards/><div className="subpage-notice"><Notice/></div></main><Footer/></>;
}

type Q = { key: string; label: string; kind?: 'multi' | 'text'; options?: string[]; hint?: string };
type Step = { title: string; note?: string; questions: Q[] };
const studentSteps: Step[] = [
  { title: 'About you', note: 'A little context helps us understand the responses. Please answer broadly.', questions: [
    { key: 'ageGroup', label: 'What is your age group?', options: ['Under 13', '13–15', '16–18', '19 or above', 'Prefer not to say'] },
    { key: 'schoolSetting', label: 'What is your school setting?', options: ['Day school', 'Boarding school', 'Both / mixed', 'Prefer not to say'] },
    { key: 'region', label: 'Which general area of Rwanda is your school located in?', options: ['Kigali City', 'Northern Province', 'Southern Province', 'Eastern Province', 'Western Province', 'Prefer not to say'] },
  ]},
  { title: 'Wellbeing & school life', note: 'We’re interested in experiences, not diagnosing anyone.', questions: [
    { key: 'wellbeingFrequency', label: 'During the past school term, how often have you felt overwhelmed by school or personal responsibilities?', options: ['Never', 'Rarely', 'Sometimes', 'Often', 'Very often', 'Prefer not to say'] },
    { key: 'challenges', label: 'What kinds of challenges have affected your wellbeing recently?', kind: 'multi', options: ['Academic pressure', 'Examinations', 'Family responsibilities', 'Relationships / friendships', 'Bullying or discrimination', 'Financial difficulties', 'Loneliness or isolation', 'Pressure about the future', 'Lack of sleep / rest', 'Changes at home', 'Social pressure', 'Other', 'Prefer not to say'] },
    { key: 'schoolImpact', label: 'How much do these challenges affect your school life?', options: ['Not at all', 'A little', 'Somewhat', 'A lot', 'Extremely', 'Prefer not to say'] },
    { key: 'schoolEffects', label: 'In what ways can these challenges affect students at school?', kind: 'multi', options: ['Difficulty concentrating', 'Reduced motivation', 'Missing classes', 'Difficulty completing schoolwork', 'Difficulty participating in class', 'Social withdrawal', 'Conflict with others', 'Feeling unable to keep up', 'Other', 'Prefer not to say'] },
  ]},
  { title: 'Support around you', note: 'There are no right answers. It’s okay if you are not sure.', questions: [
    { key: 'supportOptions', label: 'If a student at your school needed someone to talk to about a personal or emotional problem, where could they go?', kind: 'multi', options: ['Teacher', 'School counsellor', 'Parent / guardian', 'Friend', 'School administration', 'Health centre / health professional', 'Religious / community leader', 'Online resources', 'I don’t know', 'Other'] },
    { key: 'supportAwareness', label: 'How aware are you of the mental-health support available to students at your school?', options: ['Not at all aware', 'Slightly aware', 'Moderately aware', 'Very aware', 'Extremely aware', 'My school does not appear to offer this support', 'Not sure'] },
    { key: 'mentalHealthInformation', label: 'Have you ever received information at school about mental health or where students can get help?', options: ['Yes', 'No', 'Not sure', 'Prefer not to say'] },
  ]},
  { title: 'Asking for help', questions: [
    { key: 'helpSeekingComfort', label: 'If you were experiencing a difficult personal or emotional problem, how comfortable would you feel asking for help?', options: ['Very uncomfortable', 'Uncomfortable', 'Neutral', 'Comfortable', 'Very comfortable', 'Not sure'] },
    { key: 'preferredFirstContact', label: 'Who would you feel most comfortable approaching first?', options: ['Friend', 'Parent / guardian', 'Teacher', 'School counsellor', 'Health professional', 'Religious / community leader', 'Online service', 'Nobody', 'Other'] },
    { key: 'barriers', label: 'What might stop a student from seeking help?', kind: 'multi', options: ['Fear of being judged', 'Stigma', 'Not knowing where to go', 'Not trusting the available person', 'Concern about privacy', 'Fear that others will find out', 'Cost', 'Lack of time', 'Support is not available', 'Family attitudes', 'School environment', 'Believing the problem is not serious enough', 'Not knowing how to ask for help', 'Other', 'Prefer not to say'] },
  ]},
  { title: 'What is missing?', note: 'Your perspective can help identify where support could work better.', questions: [
    { key: 'schoolSupportRating', label: 'How well do you think your school currently supports students’ mental and emotional wellbeing?', options: ['Very poorly', 'Poorly', 'Fairly', 'Well', 'Very well', 'Not sure'] },
    { key: 'missingSupport', label: 'What do you think is missing from the support currently available to students?', kind: 'text', hint: 'Please do not include names or identifying details.' },
    { key: 'desiredChange', label: 'If you could change one thing about mental-health support for students at your school, what would you change?', kind: 'text', hint: 'Share only what you feel comfortable sharing.' },
  ]},
  { title: 'Possibilities, in your words', note: 'Only now are we asking about possible future support. Technology may or may not be useful.', questions: [
    { key: 'preferredSupportTypes', label: 'Which forms of support would students be most likely to use?', kind: 'multi', options: ['One-on-one conversation with a counsellor', 'Small peer-support groups', 'Trusted teacher support', 'Anonymous online information', 'Online conversation with a trained professional', 'Mental-health education sessions', 'A private digital platform', 'Helpline / chat support', 'Workshops for students', 'Support for parents', 'Other', 'Not sure'] },
    { key: 'digitalComfort', label: 'Would you be comfortable using a digital platform to learn about mental health or find support?', options: ['Definitely not', 'Probably not', 'Not sure', 'Probably yes', 'Definitely yes'] },
    { key: 'digitalTrustFactors', label: 'What would make a digital support platform feel trustworthy to you?', kind: 'multi', options: ['Privacy', 'Anonymity', 'Qualified professionals', 'School involvement', 'Ability to speak to a real person', 'Clear information', 'Easy to use', 'Available in Kinyarwanda', 'Available in English', 'Works with limited internet', 'Other'] },
    { key: 'desiredDigitalSupport', label: 'What would you want such a platform to help you with?', kind: 'text', hint: 'This is optional. Please avoid names or identifying details.' },
  ]},
];
const otherSteps: Record<'school' | 'professional' | 'other', Step[]> = {
  school: [
    { title: 'Your role & what you notice', questions: [
      { key: 'role', label: 'What is your role in education?', options: ['Teacher', 'School counsellor', 'School leader / administrator', 'Support staff', 'Other'] },
      { key: 'yearsExperience', label: 'How many years have you worked in education?', options: ['Less than 1 year', '1–5 years', '6–10 years', '11–20 years', 'More than 20 years', 'Prefer not to say'] },
      { key: 'studentApproachFrequency', label: 'How frequently do students approach staff with personal or emotional difficulties?', options: ['Never', 'Rarely', 'Sometimes', 'Often', 'Very often', 'Not sure'] },
      { key: 'commonChallenges', label: 'What challenges do you most commonly observe?', kind: 'multi', options: ['Academic pressure', 'Family responsibilities', 'Peer relationships', 'Bullying or discrimination', 'Financial difficulties', 'Loneliness', 'Pressure about the future', 'Other', 'Not sure'] },
    ]},
    { title: 'Support in schools', questions: [
      { key: 'currentSupport', label: 'What mental-health or emotional support is currently available at your school?', kind: 'multi', options: ['School counsellor', 'Teacher support', 'Referral to health services', 'Student groups', 'Education sessions', 'Community or faith-based support', 'No dedicated support', 'Not sure', 'Other'] },
      { key: 'supportResponsibility', label: 'Who is primarily responsible for supporting students at your school?', kind: 'multi', options: ['Teachers', 'School counsellor', 'School leadership', 'Health professional', 'Parents or caregivers', 'Shared responsibility', 'Other', 'Not sure'] },
      { key: 'referralEase', label: 'How easy is it to refer a student to appropriate professional support?', options: ['Very difficult', 'Difficult', 'Neither easy nor difficult', 'Easy', 'Very easy', 'Not sure'] },
      { key: 'studentSupportAwareness', label: 'How aware do students seem to be of available support?', options: ['Not at all aware', 'Slightly aware', 'Moderately aware', 'Very aware', 'Not sure'] },
      { key: 'staffTraining', label: 'How would you describe staff training to support student wellbeing?', options: ['No training', 'Limited', 'Some', 'Good', 'Extensive', 'Not sure'] },
    ]},
    { title: 'Gaps & next steps', questions: [
      { key: 'supportBarriers', label: 'What are the biggest barriers to providing effective support?', kind: 'multi', options: ['Limited trained staff', 'Time constraints', 'Limited referral options', 'Privacy concerns', 'Stigma', 'Lack of resources', 'Unclear responsibilities', 'Low student awareness', 'Family attitudes', 'Other'] },
      { key: 'missingSupport', label: 'What do you think is currently missing?', kind: 'text', hint: 'Please do not share identifiable details about any student.' },
      { key: 'additionalSupport', label: 'What additional support would schools need?', kind: 'text', hint: 'No identifying details, please.' },
      { key: 'technologyAccess', label: 'Could technology improve access or coordination for student support?', options: ['Yes', 'No', 'Not sure'] },
      { key: 'technologyProblem', label: 'If technology could help, what problem should it solve?', kind: 'text', hint: 'Optional. Include concerns as well as possibilities.' },
      { key: 'technologyReplacement', label: 'What should technology never replace in student support?', kind: 'text', hint: 'Optional.' },
      { key: 'platformConcerns', label: 'What concerns would you have about a digital mental-health platform for students?', kind: 'text', hint: 'Optional.' },
    ]},
  ],
  professional: [
    { title: 'Your perspective', questions: [
      { key: 'serviceGaps', label: 'Where do you see the most important gaps between adolescent mental-health needs and available services?', kind: 'text', hint: 'Please do not include confidential client or patient information.' },
      { key: 'recommendations', label: 'What recommendations would you offer to strengthen student-focused support?', kind: 'text', hint: 'Please do not include confidential case information.' },
    ]},
    { title: 'Recommendations', questions: [
      { key: 'technologyRole', label: 'Where, if anywhere, could technology help improve access or support?', kind: 'text', hint: 'Please consider the local context.' },
      { key: 'technologyRisks', label: 'What limitations or risks should be considered, and what should technology not replace?', kind: 'text', hint: 'Please do not include confidential client or patient information.' },
    ]},
  ],
  other: [
    { title: 'What you see', questions: [
      { key: 'youthRelationship', label: 'Which best describes your connection to students or young people?', options: ['Parent / caregiver', 'Youth worker', 'Community member', 'Researcher', 'Education supporter', 'Other'] },
      { key: 'observations', label: 'What kinds of wellbeing challenges do you notice young people facing?', kind: 'multi', options: ['School pressure', 'Family responsibilities', 'Friendship or relationship concerns', 'Bullying', 'Financial difficulties', 'Loneliness', 'Pressure about the future', 'Other', 'Not sure'] },
      { key: 'supportAwareness', label: 'How aware are you of support available to secondary-school students in your community?', options: ['Not at all aware', 'Slightly aware', 'Moderately aware', 'Very aware', 'Not sure'] },
    ]},
    { title: 'What could help?', questions: [
      { key: 'perceivedGaps', label: 'What do you think may be missing from the support available?', kind: 'text', hint: 'Please avoid names or details that identify a young person.' },
      { key: 'barriers', label: 'What might make it harder for young people to seek or receive support?', kind: 'multi', options: ['Stigma', 'Not knowing where to go', 'Cost', 'Privacy concerns', 'Limited services', 'Family or community attitudes', 'Trust', 'Other', 'Not sure'] },
      { key: 'improvements', label: 'What could improve support for students?', kind: 'text', hint: 'Optional. Please do not include identifying details.' },
      { key: 'recommendations', label: 'Is there anything else you would like the research team to understand?', kind: 'text', hint: 'Optional.' },
    ]},
  ],
};
function Consent({ onContinue, busy }: { onContinue: () => void; busy: boolean }) {
  const [ack, setAck] = useState(false);
  return <div className="consent-layout appear"><div className="consent-icon"><BookOpen size={25}/></div><span className="section-index">BEFORE YOU BEGIN</span><h1 className="serif">A few things to know.</h1><p className="consent-intro">We are conducting research to better understand mental-health support available to secondary-school students in Rwanda.</p><div className="consent-points"><p><Check size={17}/> Taking part is voluntary.</p><p><Check size={17}/> You may skip any question you do not want to answer.</p><p><Check size={17}/> Please do not include your name or identifying information in open-text responses.</p><p><Check size={17}/> This survey does not provide medical diagnosis or treatment.</p></div><div className="minor-note"><strong>For student participants</strong><p>Participation should follow the research team’s approved school, programme or adult-supervisor process. Please proceed only in line with the information and process shared with you by the research team.</p></div><label className="ack-label"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} data-testid="input-consent"/><span>I have read this information and am choosing to take part in line with the approved participation process.</span></label><button className="button button-primary button-wide" onClick={onContinue} disabled={!ack || busy} data-testid="button-begin-survey">Continue to questions <ArrowRight size={17}/></button><p className="optional-note">All questions are optional. You can leave a response blank and continue.</p></div>;
}
function Survey({ type }: { type: RespondentType }) {
  const [, setLocation] = useLocation();
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [error, setError] = useState('');
  const create = useCreateSurveySubmission();
  const steps = type === 'student' ? studentSteps : otherSteps[type];
  const setAnswer = (key: string, value: unknown) => setResponses((prev) => ({ ...prev, [key]: value }));
  const submit = () => {
    setError('');
    create.mutate({ data: { respondentType: type, consentAcknowledged: true, responses } }, {
      onSuccess: () => setLocation('/thank-you'),
      onError: () => setError('Your answers are still here. We could not send them just now. Please try again when you have a connection.'),
    });
  };
  const active = steps[step];
  return <><Header/><main className="survey-shell"><div className="survey-header"><Link href="/survey" className="back-link"><ArrowLeft size={16}/> Change respondent</Link><span className="survey-type">{identities[type].title}</span></div>{!started ? <Consent onContinue={() => setStarted(true)} busy={create.isPending}/> : <section className="survey-step appear" aria-live="polite"><div className="step-top"><div><span className="section-index">QUESTIONNAIRE · ABOUT {typeName[type].toUpperCase()}</span><h1 className="serif">{active.title}</h1>{active.note && <p className="step-note">{active.note}</p>}</div><span className="step-count">{step + 1}<i> / {steps.length}</i></span></div><div className="progress-track" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={steps.length} aria-label={`Step ${step + 1} of ${steps.length}`}><span style={{ width: `${((step + 1) / steps.length) * 100}%` }}/></div><div className="question-list">{active.questions.map((q, qi) => <Question key={q.key} q={q} number={step === 0 && type === 'student' ? qi + 1 : undefined} value={responses[q.key]} onChange={(v) => setAnswer(q.key, v)}/>)}</div>{error && <div role="alert" className="form-error"><CircleHelp size={17}/>{error}</div>}<div className="survey-actions">{step > 0 ? <button className="button button-soft" onClick={() => setStep(step - 1)} data-testid="button-previous"><ArrowLeft size={17}/> Previous</button> : <span/>}{step < steps.length - 1 ? <button className="button button-primary" onClick={() => { setError(''); setStep(step + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} data-testid="button-next">Next section <ArrowRight size={17}/></button> : <button className="button button-primary" onClick={submit} disabled={create.isPending} data-testid="button-submit-survey">{create.isPending ? 'Sending response…' : 'Send my response'} {!create.isPending && <ArrowRight size={17}/>}</button>}</div><p className="skip-reminder">You can leave any answer blank. Avoid names, contact details or exact school names.</p></section>}</main><Footer/></>;
}
function Question({ q, value, onChange, number }: { q: Q; value: unknown; onChange: (value: unknown) => void; number?: number }) {
  const selection = Array.isArray(value) ? value as string[] : [];
  const toggle = (choice: string) => onChange(selection.includes(choice) ? selection.filter((x) => x !== choice) : [...selection, choice]);
  return <fieldset className="question"><legend>{number && <span className="question-number">{String(number).padStart(2, '0')}</span>}{q.label}<small>Optional</small></legend>{q.kind === 'text' ? <><textarea value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} rows={3} placeholder="Write a few words…" aria-label={q.label} data-testid={`textarea-${q.key}`}/>{q.hint && <span className="field-hint">{q.hint}</span>}</> : <div className="choice-list">{q.options?.map((choice) => { const checked = q.kind === 'multi' ? selection.includes(choice) : value === choice; return <button key={choice} type="button" aria-pressed={checked} className={`choice-button ${checked ? 'selected' : ''}`} onClick={() => q.kind === 'multi' ? toggle(choice) : onChange(checked ? undefined : choice)} data-testid={`choice-${q.key}-${choice.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}><span className={`choice-indicator ${q.kind === 'multi' ? 'checkbox-indicator' : ''}`}>{checked && <Check size={14}/>}</span>{choice}</button>; })}</div>}</fieldset>;
}
function Thanks() {
  return <><Header/><main className="thankyou"><div className="thankyou-mark"><Check size={32}/></div><span className="section-index">RESPONSE RECEIVED</span><h1 className="serif">Thank you for<br/>contributing.</h1><p>Your response will help the Gwiza team better understand mental-health support for students in Rwanda.</p><div className="thankyou-note"><ShieldCheck size={19}/><span>Your responses are used for research. No personal identity details were requested.</span></div><Link href="/" className="button button-primary">Return to the project <ArrowRight size={17}/></Link></main><Footer/></>;
}
function Login() {
  const [, setLocation] = useLocation();
  const client = useQueryClient();
  const login = useAdminLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  return <div className="admin-login-page"><Header/><main className="login-wrap"><div className="login-aside"><span className="section-index">GWIZA RESEARCH / TEAM ACCESS</span><h1 className="serif">A clearer view<br/>of the work.</h1><p>Private workspace for the research team. Response data is only visible to authorized administrators.</p><div className="login-privacy"><LockKeyhole/><span>Protected access<br/>No respondent identity fields collected</span></div></div><form className="login-card" onSubmit={(e) => { e.preventDefault(); setError(''); login.mutate({ data: { email, password } }, { onSuccess: (session) => { client.setQueryData(getGetAdminSessionQueryKey(), session); if (session.authenticated) setLocation('/admin'); else setError('This account could not be authenticated. Please check your details.'); }, onError: () => setError('We could not sign you in. Check your details and try again.') }); }}><div className="login-icon"><LockKeyhole size={22}/></div><span className="section-index">ADMINISTRATOR ACCESS</span><h2 className="serif">Sign in</h2><label>Email address<input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-admin-email"/></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} data-testid="input-admin-password"/></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary button-wide" type="submit" disabled={login.isPending} data-testid="button-admin-login">{login.isPending ? 'Signing in…' : 'Sign in securely'} <ArrowRight size={17}/></button><p className="login-footnote">Access is limited to approved research administrators.</p></form></main><Footer/></div>;
}
type Tab = 'overview' | 'responses' | 'qualitative';
function Admin() {
  const [, setLocation] = useLocation();
  const client = useQueryClient();
  const session = useGetAdminSession({ query: { queryKey: getGetAdminSessionQueryKey(), retry: false } });
  const [tab, setTab] = useState<Tab>('overview');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const logout = useAdminLogout();
  const overview = useGetAdminOverview({ query: { queryKey: getGetAdminOverviewQueryKey(), enabled: !!session.data?.authenticated, retry: false } });
  const respondentType = filter === 'all' ? undefined : filter as RespondentType;
  const params = { respondentType, search: search || undefined, page, pageSize: 12 };
  const submissions = useListAdminSubmissions(params, { query: { queryKey: getListAdminSubmissionsQueryKey(params), enabled: !!session.data?.authenticated && tab === 'responses', retry: false } });
  const qualitative = useListQualitativeResponses({ query: { queryKey: getListQualitativeResponsesQueryKey(), enabled: !!session.data?.authenticated && tab === 'qualitative', retry: false } });
  const exportQuery = useExportSubmissionsCsv({ query: { queryKey: getExportSubmissionsCsvQueryKey(), enabled: false, retry: false } });
  const remove = useDeleteAdminSubmission();
  if (session.isLoading) return <div className="loading-page"><div className="skeleton skeleton-title"/><div className="skeleton skeleton-card"/>Checking administrator session…</div>;
  if (!session.data?.authenticated) return <><Header admin/><main className="unauthorized"><div className="login-icon"><LockKeyhole/></div><h1 className="serif">Administrator access required.</h1><p>This workspace is available to authenticated research administrators only.</p><Link href="/admin/login" className="button button-primary">Go to sign in <ArrowRight size={17}/></Link></main></>;
  const exportCsv = async () => {
    setFeedback('');
    try {
      const result = await exportQuery.refetch();
      if (result.isError || typeof result.data !== 'string') throw new Error('Export failed');
      const file = new Blob([result.data], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(file);
      const a = document.createElement('a'); a.href = url; a.download = 'gwiza-research-responses.csv'; a.click(); URL.revokeObjectURL(url);
      setFeedback('Your CSV download has started.');
    } catch { setFeedback('We could not prepare the CSV. Please try again.'); }
  };
  const deleteOne = () => {
    if (!deleting) return;
    remove.mutate({ id: deleting }, {
      onSuccess: async () => { setFeedback('Response deleted.'); setDeleting(null); await Promise.all([client.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() }), client.invalidateQueries({ queryKey: getListAdminSubmissionsQueryKey() }), client.invalidateQueries({ queryKey: getListQualitativeResponsesQueryKey() })]); },
      onError: () => setFeedback('The response was not deleted. Please try again.'),
    });
  };
  const signOut = () => logout.mutate(undefined, { onSuccess: () => { client.setQueryData(getGetAdminSessionQueryKey(), { authenticated: false, email: null }); setLocation('/admin/login'); }, onError: () => setFeedback('Could not end the session. Please try again.') });
  return <div className="admin-layout"><aside className="admin-sidebar"><Brand inverse/><div className="workspace-label">RESEARCH WORKSPACE</div><nav className="admin-nav" aria-label="Research dashboard"><button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}><span className="nav-symbol">01</span> Overview</button><button className={tab === 'responses' ? 'active' : ''} onClick={() => { setPage(1); setTab('responses'); }}><span className="nav-symbol">02</span> Responses</button><button className={tab === 'qualitative' ? 'active' : ''} onClick={() => setTab('qualitative')}><span className="nav-symbol">03</span> Qualitative</button><button onClick={exportCsv} disabled={exportQuery.isFetching}><span className="nav-symbol"><Download size={16}/></span> Download data</button></nav><div className="sidebar-bottom"><div className="admin-profile"><span className="admin-avatar">{(session.data.email || 'A').slice(0,1).toUpperCase()}</span><span><strong>Research admin</strong><small>{session.data.email}</small></span></div><button className="logout-button" onClick={signOut} disabled={logout.isPending}><LogOut size={16}/> {logout.isPending ? 'Signing out…' : 'Sign out'}</button></div></aside><main className="admin-main"><header className="admin-top"><div className="crumb">GWIZA RESEARCH <span>/</span> {tab.toUpperCase()}</div><button className="button button-soft button-small" onClick={exportCsv} disabled={exportQuery.isFetching}><Download size={16}/>{exportQuery.isFetching ? 'Preparing…' : 'Download CSV'}</button></header>{feedback && <div className="admin-feedback" role="status">{feedback}<button aria-label="Dismiss message" onClick={() => setFeedback('')}><X size={15}/></button></div>}{tab === 'overview' && <Overview overview={overview} onRetry={() => overview.refetch()} onResponses={() => setTab('responses')}/ >}{tab === 'responses' && <section className="admin-section"><div className="admin-page-heading"><div><span className="section-index">SUBMISSION RECORDS</span><h1 className="serif">Responses</h1><p>Anonymous survey submissions. Search uses submission IDs.</p></div></div><div className="table-controls"><label className="search-box"><span className="sr-only">Search response ID</span><input type="search" placeholder="Search submission ID" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} data-testid="input-response-search"/></label><label className="filter-box"><span className="sr-only">Filter respondent type</span><select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }} data-testid="select-respondent-filter"><option value="all">All respondents</option>{Object.keys(typeName).map((t) => <option value={t} key={t}>{typeName[t as RespondentType]}</option>)}</select><ChevronDown size={15}/></label></div>{submissions.isLoading ? <SkeletonRows/> : submissions.isError ? <QueryError onRetry={() => submissions.refetch()}/> : submissions.data?.items.length ? <><div className="response-list">{submissions.data.items.map((item) => <article className="response-row" key={item.id}><div className="response-meta"><span className="type-pill">{typeName[item.respondentType]}</span><time>{new Date(item.submittedAt).toLocaleDateString()}</time></div><h3>Submission <code>{item.id}</code></h3><p>{[item.ageGroup, item.region, item.schoolSetting].filter(Boolean).join(' · ') || 'No broad context answers provided'}</p><details className="answer-details"><summary>Inspect submitted answers <ChevronDown size={15}/></summary><div className="answer-list">{Object.entries(item.responses).map(([k, v]) => <div key={k}><strong>{labelize(k)}</strong><span>{formatAnswer(v)}</span></div>)}</div></details><button className="delete-button" onClick={() => setDeleting(item.id)} data-testid={`button-delete-${item.id}`}><Trash2 size={15}/> Delete response</button></article>)}</div><div className="pagination"><span>Page {submissions.data.page} of {Math.max(1, Math.ceil(submissions.data.total / submissions.data.pageSize))} · {submissions.data.total} responses</span><div><button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button disabled={page >= Math.ceil(submissions.data.total / submissions.data.pageSize)} onClick={() => setPage(page + 1)}>Next</button></div></div></> : <EmptyState title="No responses yet." body="Once participants complete a survey, anonymous submission records will appear here."/>}</section>}{tab === 'qualitative' && <section className="admin-section"><div className="admin-page-heading"><div><span className="section-index">OPEN-ENDED ANSWERS</span><h1 className="serif">Qualitative responses</h1><p>Read what participants chose to share in their own words.</p></div></div>{qualitative.isLoading ? <SkeletonRows/> : qualitative.isError ? <QueryError onRetry={() => qualitative.refetch()}/> : qualitative.data?.length ? <div className="qualitative-list">{qualitative.data.map((q) => <article className="quote-card" key={`${q.id}-${q.question}`}><div className="quote-meta"><span className="type-pill">{typeName[q.respondentType]}</span><span>ID {q.id}</span><time>{new Date(q.submittedAt).toLocaleDateString()}</time></div><span className="section-index">{q.question}</span><blockquote>“{q.answer}”</blockquote></article>)}</div> : <EmptyState title="No written responses yet." body="Optional open-ended answers will appear here as participants share them."/>}</section>}</main>{deleting && <div className="modal-backdrop" role="presentation"><section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-heading"><div className="modal-icon"><Trash2/></div><span className="section-index">PERMANENT ACTION</span><h2 id="delete-heading" className="serif">Delete this response?</h2><p>Are you sure you want to permanently delete this response? This action cannot be undone.</p><div className="delete-id"><span>Submission ID</span><code>{deleting}</code></div><div className="modal-actions"><button className="button button-soft" onClick={() => setDeleting(null)} disabled={remove.isPending}>Keep response</button><button className="button button-danger" onClick={deleteOne} disabled={remove.isPending} data-testid="button-confirm-delete">{remove.isPending ? 'Deleting…' : 'Delete response'}</button></div></section></div>}</div>;
}
function Overview({ overview, onRetry, onResponses }: { overview: UseQueryResult<AdminOverview>; onRetry: () => void; onResponses: () => void }) {
  if (overview.isLoading) return <section className="admin-section"><div className="skeleton skeleton-title"/><div className="metric-grid">{[1,2,3,4].map((i) => <div className="skeleton skeleton-card" key={i}/>)}</div><div className="skeleton skeleton-chart"/></section>;
  if (overview.isError || !overview.data) return <section className="admin-section"><QueryError onRetry={onRetry}/></section>;
  const d = overview.data;
  const tiles = [{ label: 'Total responses', value: d.totalResponses }, { label: 'Responses today', value: d.responsesToday }, { label: 'Students', value: countType(d.respondentTypes, 'student') }, { label: 'School staff', value: countType(d.respondentTypes, 'school') }, { label: 'Professionals', value: countType(d.respondentTypes, 'professional') }, { label: 'Other voices', value: countType(d.respondentTypes, 'other') }];
  const sets = [{ title: 'Respondents by type', data: d.respondentTypes }, { title: 'Student respondents by region', data: d.regions }, { title: 'School setting', data: d.schoolSettings }, { title: 'Challenges reported', data: d.challenges }, { title: 'School support rating', data: d.supportRatings }, { title: 'Help-seeking comfort', data: d.helpSeekingComfort }, { title: 'Barriers to seeking support', data: d.barriers }, { title: 'Preferred support', data: d.preferredSupportTypes }, { title: 'Digital comfort', data: d.digitalComfort }, { title: 'Digital trust factors', data: d.digitalTrustFactors }];
  return <section className="admin-section"><div className="admin-page-heading"><div><span className="section-index">THE RESEARCH, SO FAR</span><h1 className="serif">Overview</h1><p>A live view of anonymous responses collected by the GWIZA team.</p></div><span className="latest-update">Latest response <strong>{d.latestSubmission ? new Date(d.latestSubmission).toLocaleString() : 'None yet'}</strong></span></div><div className="metric-grid">{tiles.map((x) => <article className="metric-card" key={x.label}><span>{x.label}</span><strong>{x.value.toLocaleString()}</strong></article>)}</div>{d.totalResponses ? <div className="chart-grid">{sets.map((set) => <ChartPanel key={set.title} title={set.title} data={set.data}/>)}</div> : <EmptyState title="No responses yet." body="Once participants complete the survey, the research overview will begin to take shape." action={<button className="text-link-button" onClick={onResponses}>View response records <ArrowRight size={15}/></button>}/>}</section>;
}
function ChartPanel({ title, data }: { title: string; data: { label: string; count: number }[] }) {
  const maximum = Math.max(1, ...data.map((x) => x.count));
  return <article className="chart-panel"><h2>{title}</h2>{data.length ? <div className="bar-list">{data.map((item, i) => <div className="bar-row" key={item.label}><div className="bar-label"><span>{item.label}</span><strong>{item.count}</strong></div><div className="bar-track"><span style={{ width: `${Math.max(3, (item.count / maximum) * 100)}%` }} className={`bar-fill bar-${i % 4}`}/></div></div>)}</div> : <div className="chart-empty">No responses recorded in this group yet.</div>}</article>;
}
function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-mark"><Users size={23}/></div><h2 className="serif">{title}</h2><p>{body}</p>{action}</div>;
}
function QueryError({ onRetry }: { onRetry: () => void }) {
  return <div className="query-error"><CircleHelp/><h2 className="serif">We couldn’t load this research data.</h2><p>Your session is still active. Please try again in a moment.</p><button className="button button-soft" onClick={onRetry}>Retry <ArrowRight size={16}/></button></div>;
}
function SkeletonRows() {
  return <div className="skeleton-list" aria-label="Loading responses">{[1,2,3].map((i) => <div className="skeleton skeleton-row" key={i}/>)}</div>;
}
function countType(items: { label: string; count: number }[], type: string) {
  return items.find((i) => i.label.toLowerCase() === type)?.count ?? 0;
}
function labelize(s: string) {
  return s.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').replace(/^./, (x) => x.toUpperCase());
}
function formatAnswer(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.join(' · ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
function Router() {
  return <Switch><Route path="/" component={Home}/><Route path="/survey" component={ChooseSurvey}/><Route path="/survey/student"><Survey type="student"/></Route><Route path="/survey/school"><Survey type="school"/></Route><Route path="/survey/professional"><Survey type="professional"/></Route><Route path="/survey/other"><Survey type="other"/></Route><Route path="/thank-you" component={Thanks}/><Route path="/admin/login" component={Login}/><Route path="/admin" component={Admin}/><Route component={NotFound}/></Switch>;
}
function App() {
  return <QueryClientProvider client={qc}><Router/></QueryClientProvider>;
}
export default App;
