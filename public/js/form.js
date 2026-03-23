console.log('Form validation script loaded.');

document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('repForm');
  if (!form) return;

  function populateTimeDropdowns() {
    const timeInSelect = document.getElementById('timeIn');
    const timeOutSelect = document.getElementById('timeOut');
    if (!timeInSelect || !timeOutSelect) return;

    // Clear extras (keep first placeholder)
    timeInSelect.length = 1;
    timeOutSelect.length = 1;

    for (let hour = 1; hour <= 12; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const mm = minute.toString().padStart(2, '0');
        const base = `${hour}:${mm}`;

        const am = `${base} AM`;
        const pm = `${base} PM`;

        timeInSelect.add(new Option(am, am));
        timeOutSelect.add(new Option(am, am));
        timeInSelect.add(new Option(pm, pm));
        timeOutSelect.add(new Option(pm, pm));
      }
    }
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

    // timeIn/timeOut required
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

  populateTimeDropdowns();
  form.addEventListener('submit', validateAndSubmit);
});