const years = (amount) => amount * 60 * 60 * 24 * 365.25;
const months = (amount) => Math.floor(amount * 60 * 60 * 24 * 30.4167);
const days = (amount) => Math.floor(amount * 60 * 60 * 24);
const hours = (amount) => Math.floor(amount * 60 * 60);
const minutes = (amount) => Math.floor(amount * 60);

module.exports = {
  oneYear: years(1),
  years,
  oneMonth: months(1),
  months,
  days,
  hours,
  minutes,
};
