console.log('Form validation script loaded.');

document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('repForm');
  if (!form) return;

  // Populate the composite time pickers (hour, minute, AM/PM)
  function populateTimePickers() {
    const parts = ['timeIn', 'timeOut'];
    parts.forEach(prefix => {
      const hour = document.getElementById(prefix + 'Hour');
      const minute = document.getElementById(prefix + 'Minute');
      const ampm = document.getElementById(prefix + 'AmPm');
      if (!hour || !minute || !ampm) return;

      // hours 1-12
      hour.innerHTML = '';
      hour.add(new Option('Hour', ''));
      for (let h = 1; h <= 12; h++) hour.add(new Option(String(h), String(h)));

      // minutes: 00 - 59 (every minute)
      minute.innerHTML = '';
      minute.add(new Option('Min', ''));
      for (let m = 0; m < 60; m++) {
        const mm = m.toString().padStart(2, '0');
        minute.add(new Option(mm, mm));
      }

      // AM/PM
      ampm.innerHTML = '';
      ampm.add(new Option('AM/PM', ''));
      ['AM','PM'].forEach(x => ampm.add(new Option(x, x)));
    });
  }

  function showErrors(errors) {
    if (!errors || errors.length === 0) return;
    alert(errors.join('\n'));
  }

  function validateAndSubmit(e) {
    e.preventDefault();
    const errors = [];

    const roNumEl = document.getElementById('roNum');
    const roDateEl = document.getElementById('roDate');
    const technicianEl = document.getElementById('technician');
    const timeInEl = document.getElementById('timeIn');
    const timeOutEl = document.getElementById('timeOut');
    const totTimeEl = document.getElementById('totTime');
    const custNameEl = document.getElementById('custName');
    const custAddressEl = document.getElementById('custAddress');
    const custPhoneEl = document.getElementById('custPhone');
    const custEmailEl = document.getElementById('custEmail');
    const vehicleEl = document.getElementById('vehicleymm');
    const vinEl = document.getElementById('vin');
    const licenseEl = document.getElementById('licensePlate');
    const mileInEl = document.getElementById('mileIn');
    const mileOutEl = document.getElementById('mileOut');
    const diagnosisEl = document.getElementById('diagnosis');
    const taxEl = document.getElementById('tax');
    const totEstimateEl = document.getElementById('totEstimate');

    // roNum - required numeric
    const roNum = roNumEl ? roNumEl.value.trim() : '';
    if (!roNum) {
      errors.push('Repair Order number is required.');
    } else if (isNaN(Number(roNum))) {
      errors.push('Repair Order number must be a valid number.');
    }

    // roDate - required
    const roDate = roDateEl ? roDateEl.value : '';
    if (!roDate) errors.push('Date is required.');

    // technician - required, letters/spaces/hyphen/period, min length
    const technician = technicianEl ? technicianEl.value.trim() : '';
    if (!technician) {
      errors.push('Technician name is required.');
    } else if (technician.length < 2) {
      errors.push('Technician name must be at least 2 characters.');
    } else if (!/^[a-zA-Z\s\-\.]+$/.test(technician)) {
      errors.push('Technician name contains invalid characters.');
    }

  // timeIn/timeOut required (composite pickers update the hidden inputs)
  const timeIn = timeInEl ? timeInEl.value : '';
  const timeOut = timeOutEl ? timeOutEl.value : '';
  if (!timeIn) errors.push('Time In must be selected.');
  if (!timeOut) errors.push('Time Out must be selected.');

    // customer info
    const custName = custNameEl ? custNameEl.value.trim() : '';
    if (!custName) errors.push('Customer name is required.');

    const custAddress = custAddressEl ? custAddressEl.value.trim() : '';
    if (!custAddress) errors.push('Customer address is required.');
    else if (custAddress.length < 5) errors.push('Customer address must be at least 5 characters.');
    else if (custAddress.length > 100) errors.push('Customer address cannot exceed 100 characters.');

    const custPhone = custPhoneEl ? custPhoneEl.value.trim() : '';
    if (custPhone && !/^(\d{10}|\d{3}-\d{3}-\d{4})$/.test(custPhone)) {
      errors.push('Phone number must be 10 digits or XXX-XXX-XXXX.');
    }

    const custEmail = custEmailEl ? custEmailEl.value.trim() : '';
    if (custEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(custEmail)) {
      errors.push('Email must be in a valid format.');
    }

    // vehicle info
    const vehicle = vehicleEl ? vehicleEl.value.trim() : '';
    if (!vehicle) errors.push('Vehicle Year/Make/Model is required.');

    const vin = vinEl ? vinEl.value.trim() : '';
    if (vin && vin.length > 17) errors.push('VIN too long. Max 17 characters.');

    const licensePlate = licenseEl ? licenseEl.value.trim() : '';
    if (licensePlate && licensePlate.length > 10) errors.push('License plate too long. Max 10 characters.');

    // mileage
    const mileIn = mileInEl ? Number(mileInEl.value) : NaN;
    const mileOut = mileOutEl ? Number(mileOutEl.value) : NaN;
    if (isNaN(mileIn) || isNaN(mileOut)) errors.push('Mileage In and Out must be valid numbers.');
    else {
      if (mileIn < 0 || mileOut < 0) errors.push('Mileage cannot be negative.');
      if (mileOut < mileIn) errors.push('Mileage Out cannot be less than Mileage In.');
    }

    // diagnosis required (not part of 'concern/recommended/comments')
    const diagnosis = diagnosisEl ? diagnosisEl.value.trim() : '';
    if (!diagnosis) errors.push('Diagnosis is required. Put N/A if none.');

    // totals (optional but check numeric when provided)
    const tax = taxEl ? taxEl.value.trim() : '';
    if (tax !== '' && (isNaN(parseFloat(tax)) || parseFloat(tax) < 0)) errors.push('Tax must be a non-negative number.');

    const totEstimate = totEstimateEl ? totEstimateEl.value.trim() : '';
    if (totEstimate !== '' && (isNaN(parseFloat(totEstimate)) || parseFloat(totEstimate) < 0)) errors.push('Total Estimate must be a non-negative number.');

    if (errors.length > 0) {
      showErrors(errors);
      // focus the first invalid field where possible
      const firstInvalid = [roNumEl, roDateEl, technicianEl, timeInEl, timeOutEl, custNameEl, custAddressEl, mileInEl, mileOutEl, diagnosisEl].find(el => el && (!el.value || (el.tagName === 'SELECT' && el.value === '')));
      if (firstInvalid) firstInvalid.focus();
      return false;
    }

    // all good -> submit
    form.submit();
    return true;
  }

  populateTimePickers();

  // compute total time (hours) from composite pickers and write to #totTime
  function computeTotalTime() {
    const inHour = document.getElementById('timeInHour').value;
    const inMin = document.getElementById('timeInMinute').value;
    const inAmPm = document.getElementById('timeInAmPm').value;
    const outHour = document.getElementById('timeOutHour').value;
    const outMin = document.getElementById('timeOutMinute').value;
    const outAmPm = document.getElementById('timeOutAmPm').value;
    const totTimeField = document.getElementById('totTime');
    const hiddenIn = document.getElementById('timeIn');
    const hiddenOut = document.getElementById('timeOut');

    if (!inHour || !inMin || !inAmPm || !outHour || !outMin || !outAmPm) {
      if (totTimeField) totTimeField.value = '';
      if (hiddenIn) hiddenIn.value = '';
      if (hiddenOut) hiddenOut.value = '';
      return;
    }

    const inStr = `${inHour}:${inMin} ${inAmPm}`;
    const outStr = `${outHour}:${outMin} ${outAmPm}`;
    if (hiddenIn) hiddenIn.value = inStr;
    if (hiddenOut) hiddenOut.value = outStr;

    function timeToMinutes(timeStr) {
      let [time, period] = timeStr.split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      return hours * 60 + minutes;
    }

    let tIn = timeToMinutes(inStr);
    let tOut = timeToMinutes(outStr);
    if (tOut <= tIn) tOut += 24 * 60; // cross-midnight
    const diff = tOut - tIn;
    const decimalHours = diff / 60;
    if (totTimeField) totTimeField.value = decimalHours.toFixed(2);
  }

  // wire pickers to computeTotalTime
  ['timeIn','timeOut'].forEach(prefix => {
    ['Hour','Minute','AmPm'].forEach(suffix => {
      const el = document.getElementById(prefix + suffix);
      if (el) el.addEventListener('change', computeTotalTime);
    });
  });
  form.addEventListener('submit', validateAndSubmit);
});