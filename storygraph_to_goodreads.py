import csv
import argparse
from datetime import datetime
import os


def convert_date_format(date_str):
    """Convert date from StoryGraph format to Goodreads format."""
    if not date_str or not date_str.strip():
        return ""
    try:
        # Try multiple date formats that StoryGraph might use
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%B %d, %Y"):
            try:
                dt = datetime.strptime(date_str, fmt)
                # Goodreads format is YYYY/MM/DD
                return dt.strftime("%Y/%m/%d")
            except ValueError:
                continue

        # Check if it's already in Goodreads format
        try:
            dt = datetime.strptime(date_str, "%Y/%m/%d")
            return date_str  # Already in correct format
        except ValueError:
            pass

        # Return empty if no format matched
        return ""
    except:
        # Return empty if any error occurs
        return ""


def map_reading_status(status):
    """Map StoryGraph reading status to Goodreads reading status."""
    if not status:
        return "to-read"  # Default value if empty

    status = status.lower().strip()
    status_map = {
        "read": "read",
        "currently-reading": "currently-reading",
        "currently reading": "currently-reading",
        "to-read": "to-read",
        "to read": "to-read",
        "to-read pile": "to-read",
        "dnf": "abandoned",  # StoryGraph's "did not finish" to Goodreads' "abandoned"
    }
    return status_map.get(status, "to-read")  # Default to "to-read" if not found


def convert_rating(rating):
    """Convert StoryGraph rating to Goodreads format."""
    if not rating or not str(rating).strip():
        return "0"

    # Try to extract numeric value from rating
    try:
        # StoryGraph might use "5 stars" format
        if "stars" in str(rating).lower() or "star" in str(rating).lower():
            return str(int(float(rating.split()[0])))
        # Or just the number
        return str(int(float(rating)))
    except:
        return "0"


def convert_csv(storygraph_file, goodreads_file):
    """Convert StoryGraph CSV to Goodreads CSV format."""

    # Check if input file exists
    if not os.path.exists(storygraph_file):
        print(f"Error: The file '{storygraph_file}' does not exist.")
        return

    # Field mapping from StoryGraph to Goodreads (updated based on actual headers)
    field_mapping = {
        "Title": "Title",
        "Authors": "Author",  # StoryGraph uses "Authors" plural
        "ISBN/UID": "ISBN13",  # StoryGraph combines ISBN/UID
        "Format": "Binding",
        "Read Status": "Exclusive Shelf",
        "Date Added": "Date Added",
        "Last Date Read": "Date Read",
        "Read Count": "Read Count",
        "Star Rating": "My Rating",
        "Review": "My Review",
        "Tags": "Bookshelves"
    }

    # Default values for required Goodreads fields
    default_values = {
        "Book Id": "",
        "Author l-f": "",
        "Additional Authors": "",
        "ISBN": "=\"\"\"\"",  # Format for empty ISBN
        "ISBN13": "=\"\"\"\"",  # Format for empty ISBN13
        "My Rating": "0",
        "Average Rating": "",
        "Publisher": "",
        "Binding": "",
        "Number of Pages": "",
        "Year Published": "",
        "Original Publication Year": "",
        "Date Read": "",
        "Date Added": "",
        "Bookshelves": "",
        "Bookshelves with positions": "",
        "Exclusive Shelf": "to-read",  # Default is "to-read"
        "My Review": "",
        "Spoiler": "",
        "Private Notes": "",
        "Read Count": "0",
        "Owned Copies": "0"
    }

    # Read StoryGraph CSV
    with open(storygraph_file, 'r', encoding='utf-8') as infile:
        storygraph_reader = csv.DictReader(infile)
        storygraph_fieldnames = storygraph_reader.fieldnames

        # Goodreads fieldnames based on the example provided
        goodreads_fieldnames = [
            "Book Id", "Title", "Author", "Author l-f", "Additional Authors",
            "ISBN", "ISBN13", "My Rating", "Average Rating", "Publisher",
            "Binding", "Number of Pages", "Year Published", "Original Publication Year",
            "Date Read", "Date Added", "Bookshelves", "Bookshelves with positions",
            "Exclusive Shelf", "My Review", "Spoiler", "Private Notes",
            "Read Count", "Owned Copies"
        ]

        # Debug: Print the first 5 rows to check Read Status values
        print("Checking first 5 StoryGraph Read Status values:")
        sample_rows = []
        for i, row in enumerate(storygraph_reader):
            if i < 5:
                print(
                    f"Row {i + 1} Read Status: '{row.get('Read Status', '')}' -> '{map_reading_status(row.get('Read Status', ''))}'")
            sample_rows.append(row)

        # Reset file pointer for main processing
        infile.seek(0)
        next(infile)  # Skip header row
        storygraph_reader = csv.DictReader(infile, fieldnames=storygraph_fieldnames)

        # Write to Goodreads CSV
        with open(goodreads_file, 'w', encoding='utf-8', newline='') as outfile:
            goodreads_writer = csv.DictWriter(outfile, fieldnames=goodreads_fieldnames)
            goodreads_writer.writeheader()

            for row in storygraph_reader:
                goodreads_row = default_values.copy()

                # Directly map "Read Status" to "Exclusive Shelf" using our mapping function
                read_status_value = row.get("Read Status", "").strip()
                mapped_status = map_reading_status(read_status_value)
                goodreads_row["Exclusive Shelf"] = mapped_status

                # IMPORTANT: Also set Bookshelves to match Exclusive Shelf
                goodreads_row["Bookshelves"] = mapped_status

                # IMPORTANT: Format Bookshelves with positions to match Goodreads format
                goodreads_row["Bookshelves with positions"] = f"{mapped_status} (#1)"

                # Map other fields
                for sg_field, sg_value in row.items():
                    gr_field = field_mapping.get(sg_field)
                    if gr_field and gr_field in goodreads_fieldnames and gr_field != "Exclusive Shelf":  # Skip Exclusive Shelf as we've handled it
                        # Handle special cases
                        if gr_field == "Date Added":
                            date_added = convert_date_format(sg_value)
                            goodreads_row[gr_field] = date_added if date_added else "2025/01/01"  # Default if missing
                        elif gr_field == "Date Read":
                            date_read = convert_date_format(sg_value)
                            # Only set Date Read if status is "read" AND we have a valid date
                            if mapped_status == "read" and date_read:
                                goodreads_row[gr_field] = date_read
                        elif gr_field == "My Rating":
                            goodreads_row[gr_field] = convert_rating(sg_value)
                        elif gr_field == "ISBN13":
                            # Handle ISBN conversion with proper Goodreads format
                            isbn = ''.join(c for c in sg_value if c.isdigit())
                            if isbn:
                                if len(isbn) == 10:
                                    goodreads_row["ISBN"] = f'=""{isbn}""'
                                    goodreads_row["ISBN13"] = '=""=""'
                                elif len(isbn) == 13:
                                    goodreads_row["ISBN13"] = f'=""{isbn}""'
                                    goodreads_row["ISBN"] = '=""=""'
                        else:
                            goodreads_row[gr_field] = sg_value

                # Handle Author l-f (last name, first name)
                if "Author" in goodreads_row and goodreads_row["Author"]:
                    author_parts = goodreads_row["Author"].split()
                    if len(author_parts) > 1:
                        last_name = author_parts[-1]
                        first_names = ' '.join(author_parts[:-1])
                        goodreads_row["Author l-f"] = f"{last_name}, {first_names}"

                # Make sure Read Count is a number
                if "Read Count" in row and row["Read Count"] and str(row["Read Count"]).strip():
                    try:
                        goodreads_row["Read Count"] = str(max(0, int(float(row["Read Count"]))))
                    except:
                        goodreads_row["Read Count"] = "0"

                # Set "Owned Copies" based on StoryGraph's "Owned?" field
                if "Owned?" in row:
                    goodreads_row["Owned Copies"] = "1" if row["Owned?"].lower() in ["yes", "true", "y", "1"] else "0"

                # Double-check: Clear Date Read if status is not "read"
                if mapped_status != "read":
                    goodreads_row["Date Read"] = ""

                goodreads_writer.writerow(goodreads_row)

    print(f"Conversion complete! Goodreads-compatible file saved to {goodreads_file}")

    # Print status summary
    status_counts = {"read": 0, "to-read": 0, "currently-reading": 0, "other": 0}

    with open(goodreads_file, 'r', encoding='utf-8') as check_file:
        check_reader = csv.DictReader(check_file)
        for row in check_reader:
            status = row.get("Exclusive Shelf", "")
            if status in status_counts:
                status_counts[status] += 1
            else:
                status_counts["other"] += 1

    print("\nSummary of converted books by status:")
    for status, count in status_counts.items():
        if count > 0:
            print(f"  {status}: {count} books")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert StoryGraph CSV export to Goodreads import format")
    parser.add_argument("storygraph_file", help="Path to StoryGraph CSV export file")
    parser.add_argument("goodreads_file", help="Path to output Goodreads-compatible CSV file")

    args = parser.parse_args()
    convert_csv(args.storygraph_file, args.goodreads_file)