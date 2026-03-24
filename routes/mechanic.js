const express = require('express');
const router = express.Router();

router.get('/mechanic', (req, res) => {
    res.render('mechanic');
});

router.post('/mechanic', (req, res) => {
    //console.log('=== DEBUGGING REQUEST BODY ===');
    //console.log('Full req.body:', req.body);
    //console.log('Type of req.body:', typeof req.body);
    //console.log('Keys in req.body:', Object.keys(req.body));
    //console.log('===============================');

    let roNum = req.body.roNum; 
    let roDate = req.body.roDate;
    let technician = req.body.technician;
    let timeArrive = req.body.timeIn;
    let timeOut = req.body.timeOut;
    let totTime = req.body.totTime;
    let custName = req.body.custName;
    let custAdd = req.body.custAddress;
    let custPhone = req.body.custPhone;
    let custEmail = req.body.custEmail;
    let vehicleymm = req.body.vehicleymm;
    let vin = req.body.vin;  
    let licensePlate= req.body.licensePlate;
    let mileArrvive = req.body.mileIn;
    let mileOut = req.body.mileOut;
    let concern = req.body.concern;
    let diagnosis = req.body.diagnosis;
    let sDate = req.body.sDate;
    let signature = req.body.signature;
   
    console.log('RO Number:', roNum);
    console.log('Date:', roDate);
    console.log('Technician:', technician);
    console.log('Time In:', timeArrive);
    console.log('Time Out:', timeOut);
    console.log('Total Time:', totTime);
    console.log('Customer Name:', custName);
    console.log('Customer Address:', custAdd);
    console.log('Customer Phone:', custPhone);
    console.log('Customer Email:', custEmail);
    console.log('Vehicle YMM:', vehicleymm);
    console.log('VIN:', vin);
    console.log('License Plate:', licensePlate);
    console.log('Mileage In:', mileArrvive);
    console.log('Mileage Out:', mileOut);
    console.log('Concern:', concern);
    console.log('Diagnosis:', diagnosis);
    console.log('Subtotal Parts:', subTotParts);
    console.log('Subtotal Labor:', subTotLabor);
    console.log('Tax:', tax);
    console.log('Total Estimate:', totEstimate);
    console.log('Signature Date:', sDate);
    console.log('Signature:', signature);

});

module.exports = router;
