function ScheduleGenerator() {
    const [weeklySchedule, setWeeklySchedule] = React.useState(null);
    const [deskSchedule, setDeskSchedule] = React.useState(null);
    const [selectedDate, setSelectedDate] = React.useState('');
    const [error, setError] = React.useState('');

    const timeSlots = [
        { start: '9:00', end: '11:00' },
        { start: '11:00', end: '13:00' },
        { start: '13:00', end: '15:00' },
        { start: '15:00', end: '17:00' },
        { start: '17:00', end: '18:00' }
    ];

    const desks = ['Reference Desk', 'Circulation Desk', 'Information Desk'];

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);
                setWeeklySchedule(jsonData);
                setError('');
            } catch (err) {
                setError('Error processing Excel file: ' + err.message);
            }
        };

        reader.readAsArrayBuffer(file);
    };

    const calculateHoursWorked = (staffName, currentSchedule) => {
        let hours = 0;
        Object.entries(currentSchedule).forEach(([timeSlot, desks]) => {
            Object.values(desks).forEach(staffInfo => {
                if (staffInfo.name === staffName) {
                    const [start, end] = timeSlot.split('-');
                    const startHour = parseInt(start.split(':')[0]);
                    const endHour = parseInt(end.split(':')[0]);
                    hours += endHour - startHour;
                }
            });
        });
        return hours;
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

            const startColumn = `${dayOfWeek}Start`;
            const endColumn = `${dayOfWeek}End`;

            const workingStaff = weeklySchedule.filter(staff =>
                staff[startColumn] &&
                staff[startColumn] !== 'OFF' &&
                staff[endColumn] &&
                staff[endColumn] !== 'OFF'
            );

            const schedule = {};
            
            timeSlots.forEach(slot => {
                const timeSlot = `${slot.start}-${slot.end}`;
                schedule[timeSlot] = {};
                const assignedStaff = new Set();
                
                desks.forEach(desk => {
                    const availableStaff = workingStaff.filter(staff => {
                        if (assignedStaff.has(staff.Name)) return false;
                        if (calculateHoursWorked(staff.Name, schedule) >= 4) return false;
                        if (hasWorkedConsecutiveHours(staff.Name, desk, schedule, timeSlot)) return false;
                        return true;
                    });

                    // Try to assign someone with this desk as primary preference
                    let assigned = false;
                    const primaryStaff = availableStaff.find(staff => 
                        staff.PreferredDesk.split(',')[0].trim() === desk
                    );

                    if (primaryStaff) {
                        schedule[timeSlot][desk] = {
                            name: primaryStaff.Name,
                            isPrimaryPreference: true,
                            hoursWorked: calculateHoursWorked(primaryStaff.Name, schedule)
                        };
                        assignedStaff.add(primaryStaff.Name);
                        assigned = true;
                    }

                    // If no primary preference, try secondary
                    if (!assigned) {
                        const secondaryStaff = availableStaff.find(staff => 
                            staff.PreferredDesk.split(',').map(d => d.trim()).includes(desk)
                        );

                        if (secondaryStaff) {
                            schedule[timeSlot][desk] = {
                                name: secondaryStaff.Name,
                                isPrimaryPreference: false,
                                hoursWorked: calculateHoursWorked(secondaryStaff.Name, schedule)
                            };
                            assignedStaff.add(secondaryStaff.Name);
                            assigned = true;
                        }
                    }

                    // If still not assigned, assign anyone available
                    if (!assigned && availableStaff.length > 0) {
                        const staffMember = availableStaff[0];
                        schedule[timeSlot][desk] = {
                            name: staffMember.Name,
                            isPrimaryPreference: false,
                            hoursWorked: calculateHoursWorked(staffMember.Name, schedule)
                        };
                        assignedStaff.add(staffMember.Name);
                    } else if (!assigned) {
                        schedule[timeSlot][desk] = {
                            name: 'No staff available',
                            isPrimaryPreference: false,
                            hoursWorked: 0
                        };
                    }
                });
            });

            setDeskSchedule(schedule);
            setError('');
        } catch (err) {
            setError('Error generating schedule: ' + err.message);
        }
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

                    <button
                        onClick={generateDeskSchedule}
                        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                        disabled={!weeklySchedule || !selectedDate}
                    >
                        Generate Desk Schedule
                    </button>

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
                                                        Hours worked: {staffInfo.hoursWorked}
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
