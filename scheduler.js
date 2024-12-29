function ScheduleGenerator() {
    const [weeklySchedule, setWeeklySchedule] = React.useState(null);
    const [deskSchedule, setDeskSchedule] = React.useState(null);
    const [selectedDate, setSelectedDate] = React.useState('');
    const [error, setError] = React.useState('');

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);
                console.log('Loaded schedule data:', jsonData);
                setWeeklySchedule(jsonData);
                setError('');
            } catch (err) {
                setError('Error processing Excel file: ' + err.message);
                console.error('Excel processing error:', err);
            }
        };

        reader.readAsArrayBuffer(file);
    };

    const parseTime = (timeValue) => {
        if (!timeValue || timeValue === 'OFF') return null;
        
        if (timeValue instanceof Date) {
            return timeValue.getHours() + (timeValue.getMinutes() / 60);
        }
        
        if (typeof timeValue === 'string') {
            const [hours, minutes] = timeValue.split(':').map(Number);
            return hours + (minutes / 60);
        }
        
        if (typeof timeValue === 'number') {
            const totalHours = timeValue * 24;
            const hours = Math.floor(totalHours);
            const minutes = Math.round((totalHours - hours) * 60);
            return hours + (minutes / 60);
        }
        
        return null;
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

            const desks = ['Reference Desk', 'Circulation Desk', 'Information Desk'];
            const timeSlots = [
                { start: '9:00', end: '11:00' },
                { start: '11:00', end: '13:00' },
                { start: '13:00', end: '15:00' },
                { start: '15:00', end: '17:00' },
                { start: '17:00', end: '18:00' }
            ];

            const schedule = {};
            timeSlots.forEach(slot => {
                schedule[`${slot.start}-${slot.end}`] = {};
                const assignedStaff = new Set();
                
                desks.forEach(desk => {
                    const availableStaff = workingStaff.filter(staff => 
                        !assignedStaff.has(staff.Name) &&
                        staff.PreferredDesk === desk
                    );
                    
                    if (availableStaff.length > 0) {
                        schedule[`${slot.start}-${slot.end}`][desk] = availableStaff[0].Name;
                        assignedStaff.add(availableStaff[0].Name);
                    } else {
                        schedule[`${slot.start}-${slot.end}`][desk] = 'No staff available';
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
                                        {Object.entries(desks).map(([desk, staff]) => (
                                            <div 
                                                key={desk} 
                                                className={`border p-2 rounded ${
                                                    staff === 'No staff available' ? 'bg-red-50' : ''
                                                }`}
                                            >
                                                <div className="font-medium">{desk}</div>
                                                <div>{staff}</div>
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

ReactDOM.render(<ScheduleGenerator />, document.getElementById('root'));