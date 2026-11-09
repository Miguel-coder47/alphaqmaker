// Exact fractions so partial credit and passing grades never suffer rounding errors.
const gcd=(a,b)=>b?gcd(b,a%b):Math.abs(a);
export const frac=(n,d=1)=>{if(d<0){n=-n;d=-d;}const g=gcd(n,d)||1;return {n:n/g,d:d/g};};
export const ZERO=frac(0);
export const add=(a,b)=>frac(a.n*b.d+b.n*a.d,a.d*b.d);
export const toNumber=f=>f.n/f.d;
