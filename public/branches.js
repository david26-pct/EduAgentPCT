export const BRANCHES = ['Palembang Sudirman', 'Palembang OPI', 'Palembang Sako', 'Prabumulih', 'Lahat', 'Baturaja', 'Lubuk Linggau'];
// Only Lahat's official letter details have been supplied so far.
export const LETTERHEADS = {
  Lahat: {
    academic_whatsapp: '6282373725066',
    city: 'Lahat', address: 'Jl. Kolonel M. Nuh No.02 – Kota Lahat', phone: '(0731) 3200778',
    website: 'www.palcomtech.ac.id', email: 'palcomtech.lahat@palcomtech.ac.id',
    leader: 'Abdul Rajab, S.E.', leader_id: '01.PCT.16.LHT',
    contact: 'Akhmad Wan Mukhlas (Koordinator Akademik)', contact_phone: '0823-73725066',
  },
};

// The supplied QR is authorized only for Lahat PKL letters.
export function getSignatureQR(branch, requestType) {
  return branch === 'Lahat' && requestType === 'PKL' ? '/assets/signature-lahat.png' : null;
}
