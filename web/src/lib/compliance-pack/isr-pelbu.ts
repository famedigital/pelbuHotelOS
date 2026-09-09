import { PELBU_PROPERTY } from "@/lib/compliance-pack/catalog";

export type IsrBlock =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "li"; text: string }
  | { type: "note"; text: string };

/** Pelbu Suites ISR body adapted from Silverpine Boutique ISR (maternity 2 months retained). */
export const PELBU_ISR_BLOCKS: IsrBlock[] = [
  { type: "h2", text: "Preliminary" },
  {
    type: "p",
    text: `These Rules shall be called Service Rules of ${PELBU_PROPERTY.name}, Thimphu.`,
  },
  {
    type: "p",
    text: "The provision of these Rules and Regulations shall apply to all employees of the establishment.",
  },
  {
    type: "p",
    text: "These Rules shall come into effect from the approval of the Chief Labour Administrator.",
  },
  {
    type: "p",
    text: "Where the provision of this Rule conflicts with Labour Rule or where the Rules are silent, provisions of the Labour and Employment Act, 2007 shall prevail.",
  },
  {
    type: "p",
    text: "The internal service rules once approved shall be adequately and reasonably disseminated of its contents to the employees.",
  },
  {
    type: "p",
    text: "Where any provision of this Internal Service Rules is not covered under Labour and Employment Act of Bhutan, 2007, shall be dealt as per the relevant Laws of the country.",
  },

  { type: "h2", text: "Recruitment & Appointment" },
  {
    type: "p",
    text: `The Management of ${PELBU_PROPERTY.name} shall try its best to recruit only Bhutanese nationals as far as possible keeping in view of Royal Government's policy to reduce dependency on foreign workforce. Foreign workers shall be employed only when nationals are not available.`,
  },
  {
    type: "p",
    text: "Vacancies of posts as far as possible shall be advertised in the local media giving details of the requirements of the posts and shall be selected based on experience/qualification/merit.",
  },
  {
    type: "p",
    text: "The appointments shall be in line with the Labour and Employment Act 2007 and its Regulations.",
  },
  {
    type: "p",
    text: "Any employees not covered under this Internal Service Rules shall be conducted as per the Labour and Employment Act of Bhutan, 2007.",
  },

  { type: "h3", text: "Qualification for Appointment" },
  {
    type: "p",
    text: "Appointment to posts in all sections of work shall be made subject to candidates possessing the required experience & qualifications, or otherwise found suitable by the Management to carry out the duties and responsibilities of the posts.",
  },

  { type: "h3", text: "Minimum Age for Employment" },
  {
    type: "p",
    text: "Candidates seeking employment in all sections of work shall normally have attained the minimum age of 18 years (Bhutanese nationals between 13 to 17 years may however be employed against jobs/posts prescribed by MoLHR).",
  },

  { type: "h3", text: "Probation" },
  {
    type: "p",
    text: "An employee who is employed for one year or more shall be on probation for 6 months within which period either party may terminate the contract by giving the other party notice of 7 days.",
  },

  { type: "h2", text: "Hours of Work" },
  {
    type: "p",
    text: "The normal working hours for an employee shall be maximum 8 hours a day, 48 hours a week, 6 days a week.",
  },

  { type: "h3", text: "Overtime Work" },
  {
    type: "p",
    text: "An employee shall be engaged for overtime work only with his/her agreement/consent. The maximum overtime shall not exceed 12 hours per week.",
  },
  {
    type: "p",
    text: "An employee working overtime shall be paid overtime pay based on his/her basic salary for the number of hours worked. Normal rate of pay calculated on hourly basis for work other than between 10 o'clock at night and 8 o'clock in the following morning.",
  },
  {
    type: "p",
    text: "Employees working from 10:00 pm to 8:00 am next morning shall be paid overtime payment at the rate of 1.5 times the normal rate of pay calculated on hourly basis based on basic salary.",
  },
  {
    type: "p",
    text: "A pregnant employee shall not be required to work between the hours of 10 o'clock at night and 8 o'clock in the following morning: (a) 140 days before she is due to give birth and 56 days after she has given birth to the child; or (b) at any other time if the employee produces a medical certificate showing that such work would endanger the child or the mother.",
  },

  { type: "h3", text: "Meal Intervals and Rest Period" },
  {
    type: "p",
    text: "An employee shall be entitled to a meal break of minimum of 30 minutes after four hours of work and the meal break shall be excluded in the working hours.",
  },
  {
    type: "p",
    text: "A Contract of Employment agreement drawn up at the time of appointment may dispense the meal break if the employee works less than four hours a day.",
  },

  { type: "h3", text: "Daily and weekly Rest Period" },
  {
    type: "p",
    text: "An employee shall have: a daily rest period of 12 consecutive hours; and a weekly rest period of 24 consecutive hours (one day).",
  },

  { type: "h3", text: "Night Work" },
  {
    type: "li",
    text: "His/her safety shall be ensured by the establishment.",
  },
  {
    type: "li",
    text: "An employee who works regularly between 10:00 P.M and 8:00 A.M shall be informed of health hazards.",
  },
  {
    type: "li",
    text: "Have the right to undergo medical examination to determine the medical fitness to work at night.",
  },

  { type: "h2", text: "Payment of Wages/Salary" },
  {
    type: "p",
    text: "A contract agreement signed with each employee shall specify a monthly pay scale & allowances.",
  },
  {
    type: "p",
    text: "An employee shall be paid wages/salary in the 1st week of every month.",
  },
  {
    type: "p",
    text: "An employer shall have the right to withhold upto a maximum of 50% of wages/salary (including other mandatory deductions).",
  },
  {
    type: "p",
    text: "An employee shall draw his/her increment in the pay scale after completion of the probation period.",
  },

  { type: "h2", text: "Public Holidays" },
  {
    type: "p",
    text: "An employee shall be entitled to 9 public holidays including National Day and His Majesty's Birth Day with full salary.",
  },
  {
    type: "p",
    text: "Public holidays shall be staggered between different employees to ensure that an establishment continues to be operational on such holidays unless the management decides to remain the establishment closed on such holidays.",
  },
  {
    type: "p",
    text: "Should the exigencies of the establishment require an employee to work on public holidays: the employee may be engaged in work with his/her agreement; the employee shall be compensated with remuneration at 1.5-time normal rate of pay calculated at hourly basis; or exchange a public holiday with another public holiday by mutual agreement.",
  },

  { type: "h2", text: "Training" },
  {
    type: "p",
    text: "Training period of six months or less shall be considered as Short-Term Training (STT); and training period of more than six months shall be considered as Long-Term Training (LTT).",
  },
  {
    type: "p",
    text: "Short-Term (STT): An employee after completing STT shall serve the enterprise for 6 months; however, in the event that the employee resigns before completing the obligation period, the employee shall refund the expenditure incurred by the employer for the training. Such refund may be waived off by the employer at their discretion.",
  },
  {
    type: "p",
    text: "Long-Term Training (LTT): An employee after completing LTT shall serve the enterprise for maximum of double the duration of the LTT. In the event the employee does not fulfill their obligation or fails to return on completion of the training, the employee shall refund not exceeding double the total amount of all the expenses incurred by the employer. Such refund may be waived off by the employer at their discretion.",
  },
  {
    type: "p",
    text: "If the employee fails to complete the course or withdrew/discontinued for reasons other than ill-health, the employee shall refund though not exceeding double the total amount of all the expenses incurred by the employer. Such refund may be waived off by the employer at their discretion.",
  },
  {
    type: "p",
    text: "In case of the demise of an employee during the study period or before completing the obligation, the financial obligations shall be null and void. The obligation of an employee on LTT may be partially or fully waived off by the employer at their discretion.",
  },

  { type: "h2", text: "Promotion" },
  {
    type: "p",
    text: "An employee shall be considered for promotion to the next higher level purely based on his/her performance. No employee shall claim promotion as a matter of right or automatic entitlement.",
  },

  { type: "h2", text: "Leave for regular employee" },
  {
    type: "p",
    text: "Employees under probation period shall not be entitled for casual leave.",
  },
  {
    type: "p",
    text: "An employee shall be entitled to 18 days of earned annual leave in total in a calendar year. An employee shall apply for annual leave at least 14 calendar days before the date from which leave is required.",
  },
  {
    type: "p",
    text: "Leave without pay: Employees not attending the duty without prior information shall be treated as absent and payment will be deducted accordingly.",
  },
  {
    type: "h3",
    text: "Maternity leave",
  },
  {
    type: "p",
    text: "A female employee shall be entitled to two months maternity leave and in addition entitled to unused annual or sick leave entitlements to extend the period of paid leave.",
  },
  {
    type: "p",
    text: "A female employee shall be entitled to maternity leave with salary subject to three confinements during the entire service of the employee.",
  },
  {
    type: "h3",
    text: "Paternity leave",
  },
  {
    type: "p",
    text: "An employee shall be entitled to 10 days of paternity leave for three child births.",
  },
  {
    type: "h3",
    text: "Medical leave",
  },
  {
    type: "p",
    text: "An employee, if hospitalized shall be entitled to medical leave on genuineness for a maximum period of one month on production of a medical certificate from a recognized medical practitioner in Bhutan.",
  },
  {
    type: "h3",
    text: "Casual leave",
  },
  {
    type: "p",
    text: "An employee shall be entitled to a minimum 5 days casual leave in a calendar year. Casual leave, if not availed during the calendar year, shall be merged with earned leave of an employee at the end of each calendar year. Probationers availing casual leave besides sick leave shall not be entitled to wages for the number of days he/she remained absent.",
  },
  {
    type: "h3",
    text: "Sick leave",
  },
  {
    type: "p",
    text: "An employee shall be entitled to minimum of 5 working days per year as sick leave after notifying employer in advance of any sickness. The employer shall produce evidence of nature of sickness which will include a signed certificate from a registered medical practitioner in Bhutan indicating the employee is sick and unfit for work.",
  },

  { type: "h2", text: "Service Benefits" },
  {
    type: "h3",
    text: "Insurance",
  },
  {
    type: "p",
    text: "An employee shall have to be covered by the Group Insurance Scheme of the Royal Insurance Corporation of Bhutan (RICB) or Bhutan Insurance Limited (BIL). The premium shall be deducted at source every month by the employer.",
  },
  {
    type: "h3",
    text: "Provident Fund",
  },
  {
    type: "p",
    text: "An employee shall be a member of the Provident Fund Scheme of the BIL and 5% of the employee's monthly basic salary shall be deducted and deposited to the individual Provident Fund Account along with the matching contribution from the Management. Both employer and employee's contribution with interest shall be paid to the employee who completes regular service of five years. Only employee's contribution with interest shall be paid to the employee who resigns before 5 years term.",
  },
  {
    type: "h3",
    text: "Bonus",
  },
  {
    type: "p",
    text: "An employee shall be entitled to bonus on the annual profit after tax or after due observance of individual performance. No individual shall claim it as a matter of right.",
  },
  {
    type: "h3",
    text: "Advances",
  },
  {
    type: "p",
    text: "An employee may be entitled to interest free special advances for meeting personal expenses on repayment on monthly basis within a calendar year: Marriage of self — maximum upto 2 months' salary; Medical ground — one month's salary subject to degree of health condition and on production of a medical certificate from a recognized medical practitioner in Bhutan.",
  },
  {
    type: "h3",
    text: "Fooding & Lodging",
  },
  {
    type: "p",
    text: "Besides salary, free fooding (simple) i.e. breakfast, lunch and dinner shall be provided. Free accommodation (if there is space in the hotel) shall be provided for single employees working overtime. Hotel dresses shall be provided to all the employees.",
  },
  {
    type: "h3",
    text: "Assistance to meet funeral expenses",
  },
  {
    type: "p",
    text: "In case of employee's death while on duty/accident/otherwise, the management shall grant 2 months' salary to a maximum of Nu. 10,000/- as an assistance to meet the funeral expenses of the deceased to his/her immediate kin.",
  },

  { type: "h2", text: "Service Record" },
  {
    type: "p",
    text: "A service record book will be maintained showing the details of pay and allowances, leave account, provident fund and other administrative proceedings.",
  },

  { type: "h2", text: "Conduct and Discipline" },
  {
    type: "p",
    text: "In the following cases of misconduct an employee shall be liable for punishment, including termination from the service:",
  },
  { type: "li", text: "Fraud, theft or misuse of the enterprise's/employer's property, including employer's intellectual property" },
  { type: "li", text: "Theft or damage of guest's property" },
  { type: "li", text: "Assault and other serious crime" },
  { type: "li", text: "Willful insubordination or disobedience of a repeated or serious character" },
  { type: "li", text: "Habitual irregular attendance" },
  { type: "li", text: "Sabotage" },
  { type: "li", text: "Sexual harassment of co-workers" },
  { type: "li", text: "Abandonment of the employee's post" },
  { type: "li", text: "Persistent absence from the workplace without good excuse" },
  { type: "li", text: "Willfully offending the Tsa-Wa-Sum" },
  {
    type: "p",
    text: "Depending on the nature and severity of any misconduct, an employee may be imposed any of the following penalties: Reprimand; Withhold increment(s); Withhold Promotion or demote to lower level/position; Compulsory retirement; Termination with benefits; Termination without benefits.",
  },

  { type: "h2", text: "Retrenchment, Resignation and Superannuation" },
  {
    type: "p",
    text: "A management shall have the right to retrench the employees depending on the needs and viability of the business, conducted as per sections 68 to 70 of Labour and Employment Act of Bhutan, 2007, with notice and notification to the Chief Labour Administrator.",
  },
  {
    type: "p",
    text: "An employee intending to resign from the service shall inform/notify the employer in writing of his intention one month in advance. In the event he/she fails to do so, the employer shall be compensated with one month's of his/her basic pay in lieu of the notice period. The length of termination and compensation in lieu of notice period shall be same for the employer and employee.",
  },
  {
    type: "p",
    text: "An employee shall be superannuated on completion of 50 years of age. However, the management may extend the superannuating age of an employee up to a maximum of an additional two to four years based on physical fitness and other merits of the employee.",
  },
  {
    type: "p",
    text: "An employee who retires on superannuation or after completion of 5 years' service shall be eligible for receiving their PF & GIS benefits and leave balance.",
  },
  {
    type: "p",
    text: "Gratuity: An employee who retires on superannuation or resigns after completion of 10 years' service shall be eligible for receiving gratuity equivalent to one month's last basic pay drawn times the number of years completed continuous years of service, including probation period. A gratuity shall be paid to the dependents/nominees of an employee whose employment is terminated by death within 15 working days.",
  },

  { type: "h2", text: "Sexual Harassment" },
  {
    type: "p",
    text: "Sexual harassment in the workplace or during recruitment includes: an unwelcome sexual advance or an unwelcome request for sexual favours by one person to another; or any other unwelcome physical, verbal, or visual conduct of a sexual nature by one person to another.",
  },
  {
    type: "p",
    text: "Every enterprise shall prepare and implement a Policy on Prevention of Sexual Harassment. A victim may lodge a complaint with the employing agency or the Royal Bhutan Police. The employer may be legally liable if they knew or reasonably should have known of the harassment and failed to take action.",
  },

  { type: "h2", text: "Grievance Procedure" },
  {
    type: "p",
    text: "Policy: ensure that complaints and problems within the enterprise are resolved without the need for government intervention; prevent minor labour problems from escalating into a formal dispute; encourage cooperation and build trust between workers and managers.",
  },
  {
    type: "p",
    text: "The procedure shall be prepared in consultation with the employees, written in simple language, and reviewed periodically. Employer shall not retaliate against an employee who lodges a complaint. Employee lodging the complaint shall have the right for representative from within or outside the company.",
  },
  {
    type: "p",
    text: "Steps: aggrieved complainant shall make complaint in writing; designated officer shall acknowledge within two working days and commence investigation within 5 working days; complaint shall be dealt with within 10 working days from commencement of investigation. If unresolved, parties shall notify the Chief Labour Administrator that a labour dispute exists.",
  },

  { type: "h2", text: "Occupational Health and Safety Policy" },
  {
    type: "p",
    text: "Policy: establish standards on occupational health, safety and welfare of premises, instruments, appliances, tools and other hazardous conditions to ensure safety, health and welfare of employees from work related risk to health.",
  },
  {
    type: "p",
    text: "Duties of Employer: ensure health and safety of all employees; improve hazardous working conditions; make employees aware of hazards and rights; establish OHS policies; provide and maintain protective equipment; provide information, instruction and supervision.",
  },
  {
    type: "p",
    text: "Duties of Employees: carry out work in accordance with established safe work procedures; use protective equipment; not engage in horseplay; not work impaired by alcohol or drugs; report defects and contraventions.",
  },

  { type: "h2", text: "Workers' Compensation" },
  {
    type: "p",
    text: "The company shall insure employees with an authorized insurer (Bhutan Insurance Limited or equivalent) so that compensations are covered as per Labour Laws. The agreed premium shall be paid by the company and shall not be deducted from the employees' wage/salary. Compensation for injuries, diseases or death arising out of and in the course of employment shall be as per the Labour and Employment Act of Bhutan 2007 and its regulations.",
  },

  { type: "h2", text: "Miscellaneous" },
  {
    type: "p",
    text: "This Service Rules and Regulations shall be reviewed, and, if necessary, revised from time to time by the management.",
  },
  {
    type: "p",
    text: "Employment of foreign workers shall be in line with the Labour and Employment Act, 2007 and Immigration Act, 2007.",
  },
  {
    type: "note",
    text: "Annexures (Contract of Employment sample, Job responsibilities, OHS Policy Statement) follow after the signature block. Fill blanks by hand when printing for MoLHR.",
  },
];

export const PELBU_ISR_VERSION = "Pelbu Suites ISR v1 — adapted from boutique hotel ISR template for MoLHR submission";
