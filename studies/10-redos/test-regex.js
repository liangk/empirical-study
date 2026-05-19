const emailRegex = /^[^@]+@[^@]+\.[^@]+$/;
const urlRegex = /^https?:\/\/[^\/]+\/.*$/;
const badRegex = /(a|a)*/;
const nestedRegex = /(a*)*/;
const simpleEmail = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const overlapping = /(token|token)+/;
const largeRepeat = /a{100,}/;