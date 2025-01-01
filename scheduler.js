function ScheduleGenerator() {
    const [weeklySchedule, setWeeklySchedule] = React.useState(null);
    const [deskSchedule, setDeskSchedule] = React.useState(null);
    const [selectedDate, setSelectedDate] = React.useState('');
    const [error, setError] = React.useState('');

    const timeSlots = [
        { start: '09:00', end: '11:00' },
        { start: '11:00', end: '13:00' },
        { start: '13:00', end: '15:00' },
        { start: '15:00', end: '17:00' },
        { start: '17:00', end: '18:00' }
    ];

    const desks = ['Reference Desk', 'Circulation Desk', 'Information Desk'];

    const convertExcelTime = (excelTime) => {
        if (excelTime === "OFF") return "OFF";
        const totalHours = excelTime * 24;
        const hours = Math.floor(totalHours);
        const minutes = Math.round((totalHours - hours) * 60);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    };

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);
                
                // Process the data to correct format
                const processedData = jsonData.map(row => ({
                    Name: row.__EMPTY,
                    PreferredDesk: row.PreferredDesk,
                    MondayStart: convertExcelTime(row.MondayStart),
                    MondayEnd: convertExcelTime(row.MondayEnd),
                    TuesdayStart: convertExcelTime(row.TuesdayStart),
                    TuesdayEnd: convertExcelTime(row.TuesdayEnd),
                    WednesdayStart: convertExcelTime(row.WednesdayStart),
                    WednesdayEnd: convertExcelTime(row.WednesdayEnd),
                    ThursdayStart: convertExcelTime(row.ThursdayStart),
                    ThursdayEnd: convertExcelTime(row.ThursdayEnd),
                    FridayStart: convertExcelTime(row.FridayStart),
                    FridayEnd: convertExcelTime(row.FridayEnd),
                    SaturdayStart: convertExcelTime(row.SaturdayStart),
                    SaturdayEnd: convertExcelTime(row.SaturdayEnd)
                }));
                
                console.log('Processed schedule data:', processedData);
                setWeeklySchedule(processedData);
                setError('');
            } catch (err) {
                setError('Error processing Excel file: ' + err.message);
                console.error('Excel processing error:', err);
            }
        };

        reader.readAsArrayBuffer(file);
    };

    const timeToMinutes = (timeStr) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    };

    const isTimeInRange = (startTime, endTime, slotStart, slotEnd) => {
        const start = timeToMinutes(startTime);
        const end = timeToMinutes(endTime);
        const slotStartMin = timeToMinutes(slotStart);
        const slotEndMin = timeToMinutes(slotEnd);
        return start <= slotStartMin && end >= slotEndMin;
    };

    const calculateHoursWorked = (staffName, currentSchedule) => {
        let minutes = 0;
        Object.entries(currentSchedule).forEach(([timeSlot, desks]) => {
            Object.values(desks).forEach(staffInfo => {
                if (staffInfo.name === staffName) {
                    const [start, end] = timeSlot.split('-');
                    minutes += timeToMinutes(end) - timeToMinutes(start);
                }
            });
        });
        return minutes / 60;
    };

    const hasWorkedConsecutiveHours = (staffName, desk, currentSchedule, currentSlot) => {
        const currentIndex = timeSlots.findIndex(slot => 
            `${slot.start}-${slot.end}` === currentSlot
        );
        if (currentIndex <= 0) return false;

        const previousSlot = `${timeSlots[currentIndex - 1].start}-${timeSlots[currentIndex - 1].end}`;
        return currentSchedule[previousSlot]?.[desk]?.name === staffName;
    };

    const generateDeskSchedule = () => {
        try {
            if (!weeklySchedule || !selectedDate) {
                setError('Please upload a schedule and select a date');
                return;
            }

            const [year, month, day] = selectedDate.split('-').map(Number);
            const date = new Date(year, month - 1, day);
            const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
            console.log('Processing schedule for:', dayOfWeek);

            const startColumn = `${dayOfWeek}Start`;
            const endColumn = `${dayOfWeek}End`;

            const workingStaff = weeklySchedule.filter(staff =>
                staff[startColumn] &&
                staff[startColumn] !== 'OFF' &&
                staff[endColumn] &&
                staff[endColumn] !== 'OFF'
            );

            console.log('Working staff:', workingStaff);

            const schedule = {};
            
            timeSlots.forEach(slot => {
                const timeSlot = `${slot.start}-${slot.end}`;
                schedule[timeSlot] = {};
                const assignedStaff = new Set();

                // For each desk
                desks.forEach(desk => {
                    // Find available staff who prefer this desk and are working during this slot
                    const availableStaff = workingStaff.filter(staff => {
                        if (assignedStaff.has(staff.Name)) return false;
                        if (calculateHoursWorked(staff.Name, schedule) >= 4) return false;
                        if (hasWorkedConsecutiveHours(staff.Name, desk, schedule, timeSlot)) return false;
                        
                        return isTimeInRange(
                            staff[startColumn],
                            staff[endColumn],
                            slot.start,
                            slot.end
                        );
                    });

                    // Sort by preference
                    const staffForDesk = availableStaff
                        .filter(staff => staff.PreferredDesk === desk)
                        .sort((a, b) => calculateHoursWorked(a.Name, schedule) - calculateHoursWorked(b.Name, schedule));

                    if (staffForDesk.length > 0) {
                        const selectedStaff = staffForDesk[0];
                        schedule[timeSlot][desk] = {
                            name: selectedStaff.Name,
                            isPrimaryPreference: true,
                            hoursWorked: calculateHoursWorked(selectedStaff.Name, schedule)
                        };
                        assignedStaff.add(selectedStaff.Name);
                    } else {
                        // If no preferred staff, assign anyone available
                        const anyAvailable = availableStaff
                            .filter(staff => !assignedStaff.has(staff.Name))
                            .sort((a, b) => calculateHoursWorked(a.Name, schedule) - calculateHoursWorked(b.Name, schedule));

                        if (anyAvailable.length > 0) {
                            const selectedStaff = anyAvailable[0];
                            schedule[timeSlot][desk] = {
                                name: selectedStaff.Name,
                                isPrimaryPreference: false,
                                hoursWorked: calculateHoursWorked(selectedStaff.Name, schedule)
                            };
                            assignedStaff.add(selectedStaff.Name);
                        } else {
                            schedule[timeSlot][desk] = {
                                name: 'No staff available',
                                isPrimaryPreference: false,
                                hoursWorked: 0
                            };
                        }
                    }
                });
            });

            setDeskSchedule(schedule);
            setError('');
        } catch (err) {
            setError('Error generating schedule: ' + err.message);
            console.error('Schedule generation error:', err);
        }
    };

const exportToWord = () => {
    // Helper function to convert 24h to 12h format
    const formatTime = (time24) => {
        const [hours, minutes] = time24.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
    };

    // Helper function to format time slot
    const formatTimeSlot = (timeSlot) => {
        const [start, end] = timeSlot.split('-');
        return `${formatTime(start)} - ${formatTime(end)}`;
    };

    const scheduleHTML = `
        <html>
        <head>
            <style>
                table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
                th, td { border: 1px solid black; padding: 8px; text-align: left; }
                th { background-color: #f0f0f0; }
                h1 { text-align: center; }
                h2 { color: #2c5282; margin-top: 20px; }
            </style>
        </head>
        <body>
            <h1>Desk Schedule for ${selectedDate}</h1>
            ${Object.entries(deskSchedule).map(([timeSlot, desks]) => `
                <h2>${formatTimeSlot(timeSlot)}</h2>
                <table>
                    <tr>
                        ${Object.entries(desks).map(([desk, staffInfo]) => `
                            <td>
                                <strong>${desk}</strong><br/>
                                ${staffInfo.name}
                            </td>
                        `).join('')}
                    </tr>
                </table>
            `).join('')}
        </body>
        </html>
    `;

    const blob = new Blob([scheduleHTML], { type: 'application/msword' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Schedule_${selectedDate}.doc`;
    link.click();
};

    return (
        <div className="max-w-4xl mx-auto p-4">
            <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-2xl font-bold mb-4">Library Desk Schedule Generator</h2>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Upload Weekly Schedule (Excel)</label>
                        <input
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleFileUpload}
                            className="block w-full text-sm border rounded p-2"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Select Date</label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="block w-full text-sm border rounded p-2"
                        />
                    </div>

                    {error && (
                        <div className="text-red-500 text-sm mt-2">
                            {error}
                        </div>
                    )}

                    <div className="flex space-x-4">
                        <button
                            onClick={generateDeskSchedule}
                            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                            disabled={!weeklySchedule || !selectedDate}
                        >
                            Generate Desk Schedule
                        </button>

                        {deskSchedule && (
                            <button
                                onClick={exportToWord}
                                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                            >
                                Export to Word
                            </button>
                        )}
                    </div>

                    {deskSchedule && (
                        <div className="mt-6">
                            <h3 className="text-lg font-semibold mb-4">Desk Schedule for {selectedDate}</h3>
                            {Object.entries(deskSchedule).map(([timeSlot, desks]) => (
                                <div key={timeSlot} className="mb-4">
                                    <h4 className="font-medium">{timeSlot}</h4>
                                    <div className="grid grid-cols-3 gap-4 mt-2">
                                        {Object.entries(desks).map(([desk, staffInfo]) => (
                                            <div 
                                                key={desk} 
                                                className={`border p-2 rounded ${
                                                    staffInfo.name === 'No staff available' ? 'bg-red-50' : 
                                                    staffInfo.isPrimaryPreference ? 'bg-green-50' : ''
                                                }`}
                                            >
                                                <div className="font-medium">{desk}</div>
                                                <div>{staffInfo.name}</div>
                                                {staffInfo.name !== 'No staff available' && (
                                                    <div className="text-xs text-gray-600">
                                                        Hours worked: {staffInfo.hoursWorked.toFixed(1)}
                                                        {staffInfo.isPrimaryPreference && 
                                                            <span className="text-green-600 ml-2">Primary Preference</span>
                                                        }
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<ScheduleGenerator />);
