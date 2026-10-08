/**
 * All editable presentation content lives here.
 * Replace the [bracketed] placeholders with your real details.
 */
export const presentationData = {
  projectTitle: 'ExpenSense',
  tagline: 'Track Smarter. Live Better.',
  subtitle: 'Intelligent Finance & Expense Tracking with Receipt Recognition',

  // Slide 2 — Presented by
  presentedBy: {
    // Featured on top, larger. Put your name here.
    // photo: file in public/assets/team/ — falls back to initials if missing.
    lead: { name: 'James Ryan Amba', role: 'Lead Developer', photo: 'assets/team/amba.png' },
    // Shown below the lead.
    team: [
      { name: 'Graco Aloba', role: 'Co-Developer & QA', photo: 'assets/team/aloba.png' },
      { name: 'Ellijan Esquivel', role: 'Co-Developer & QA', photo: 'assets/team/esquivel.png' },
      { name: 'Jed Ortega', role: 'Co-Developer & QA', photo: 'assets/team/ortega.png' },
    ],
  },

  // Slide 3 — Problem
  problem: {
    question: 'Where does my money go?',
    support:
      'Small, everyday expenses add up quietly. Receipts get lost, and totals rarely tell the full story.',
    categories: ['Food', 'Transportation', 'School', 'Daily Expenses'],
  },

  // Slide 4 — Who are the users
  users: [
    {
      title: 'Students',
      description: 'Managing allowances across food, fares, and school needs.',
      icon: 'GraduationCap',
    },
    {
      title: 'Young earners',
      description: 'Handling a first salary and building better money habits.',
      icon: 'Briefcase',
    },
    {
      title: 'Everyday spenders',
      description: 'Anyone who wants a clear view of daily expenses.',
      icon: 'ShoppingBag',
    },
  ],

  // Slide 5 — Scope & limitations (edit to match your final documentation)
  scope: {
    current: [
      'Receipt capture and recognition',
      'Manual expense entry',
      'Transaction history',
      'Wallet and budget tracking',
      'Spending analytics by category',
    ],
    limitations: [
      'Recognition quality depends on receipt image clarity',
      'Extracted details should be reviewed before saving',
      'Requires an internet connection to sync data',
      '[Add another limitation]',
    ],
  },

  // Slide 6 — Solution workflow
  workflow: [
    { step: 'Capture', description: 'Snap or upload a receipt', icon: 'Camera' },
    { step: 'Recognize', description: 'Extract merchant, items, total', icon: 'ScanLine' },
    { step: 'Review', description: 'Verify and correct details', icon: 'ClipboardCheck' },
    { step: 'Save', description: 'Added to your ledger', icon: 'ReceiptText' },
    { step: 'Understand', description: 'Budget and analytics', icon: 'PieChart' },
  ],

  // Slide 7 — Features (max 6)
  features: [
    { title: 'Receipt Scanner', description: 'Capture receipts and extract expense details.', icon: 'ScanLine' },
    { title: 'Manual Entry', description: 'Log any expense in a few taps.', icon: 'PencilLine' },
    { title: 'Transactions', description: 'Every expense with merchant, amount, and date.', icon: 'ReceiptText' },
    { title: 'Wallet & Budget', description: 'See your balance and what remains.', icon: 'Wallet' },
    { title: 'Analytics', description: 'Spot spending patterns over time.', icon: 'PieChart' },
    { title: 'Categories', description: 'Organize spending by type.', icon: 'Tags' },
  ],

  // Slide 8 — Demo
  demo: {
    videoPath: 'assets/video/expensense-demo.mp4',
    posterPath: 'assets/video/poster.png',
    // Shown in the PDF export instead of the video. Set to your hosted link, or leave empty.
    link: '',
  },

  // Slide 9 — Closing
  closing: {
    callback: 'Where does my money go?',
    answer: 'Know where your money goes.',
  },
};

export type PresentationData = typeof presentationData;
