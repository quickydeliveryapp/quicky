// Database ke purane messages ko English mein dikhane ke liye (SQL change ki zaroorat nahi)
const map: Record<string, string> = {
  "Login required": "Please log in to continue.",
  "Koi shop abhi ye items deliver nahi kar sakti": "No shop can deliver these items to you right now.",
  "Ye QR aapke order ka nahi hai": "This QR code doesn't belong to your order.",
  "Order abhi pickup ke liye ready nahi hai": "This order isn't ready for pickup yet.",
  "Order kisi aur ne le liya": "Another rider already took this order.",
  "Pehle Online ho jao": "Go online first.",
  "Online hona ya admin approval baaki hai": "You must be online and approved by an admin.",
  "Order deliver nahi ho sakta": "This order can't be marked as delivered.",
  "Aapki koi shop nahi mili": "No shop found for your account.",
  "Barcode aur naam zaroori hain": "Barcode and name are required.",
  "Sirf riders ke liye": "Riders only.",
  "Sirf admin": "Admins only.",
  "Not allowed": "You don't have permission to do this.",
};
export const friendly = (m: string) => map[m] ?? m;
