#!/usr/bin/env python3
"""
Interactive tool for exploring search capabilities.
"""

import sys
import json
import os
from datetime import datetime
import quilt3
from quilt3.exceptions import QuiltException


class SearchExplorer:
    """Interactive search explorer."""
    
    def __init__(self):
        self.search_history = []
        self.saved_results = {}
        
    def interactive_search_session(self):
        """Interactive CLI for testing search queries."""
        print("Quilt3 Interactive Search Explorer")
        print("=" * 40)
        print("Type 'help' for commands, 'quit' to exit")
        print()
        
        # Check login status
        try:
            from quilt3.api import get_user
            user = get_user()
            if not user:
                print("Warning: Not logged in to quilt3. Some features may not work.")
                print("Run 'quilt3 login' to authenticate.\n")
            else:
                print(f"Logged in as: {user}\n")
        except Exception as e:
            print(f"Warning: Could not check login status: {e}\n")
        
        while True:
            try:
                user_input = input("search> ").strip()
                
                if not user_input:
                    continue
                    
                if user_input.lower() in ['quit', 'exit', 'q']:
                    break
                elif user_input.lower() == 'help':
                    self.show_help()
                elif user_input.lower() == 'history':
                    self.show_history()
                elif user_input.lower() == 'saved':
                    self.show_saved_results()
                elif user_input.startswith('save '):
                    self.save_last_results(user_input[5:])
                elif user_input.startswith('load '):
                    self.load_saved_results(user_input[5:])
                elif user_input.startswith('compare '):
                    self.compare_saved_results(user_input[8:])
                elif user_input.startswith('bucket '):
                    self.search_in_bucket(user_input[7:])
                elif user_input.startswith('limit '):
                    parts = user_input[6:].split(' ', 1)
                    if len(parts) == 2:
                        try:
                            limit = int(parts[0])
                            query = parts[1]
                            self.perform_search(query, limit=limit)
                        except ValueError:
                            print("Invalid limit value. Use: limit <number> <query>")
                    else:
                        print("Usage: limit <number> <query>")
                else:
                    # Default search
                    self.perform_search(user_input)
                    
            except KeyboardInterrupt:
                print("\nExiting...")
                break
            except Exception as e:
                print(f"Error: {e}")
        
        print("Thank you for using Search Explorer!")
    
    def show_help(self):
        """Show available commands."""
        help_text = """
Available commands:

Basic search:
  <query>              - Search for packages matching query
  limit <n> <query>    - Search with specific result limit
  bucket <name>        - Search within specific bucket

History and results:
  history              - Show search history
  save <name>          - Save last search results with a name
  saved                - Show saved result sets
  load <name>          - Load and display saved results
  compare <name1> <name2> - Compare two saved result sets

Other:
  help                 - Show this help
  quit/exit/q          - Exit explorer

Examples:
  data
  limit 5 example
  bucket quilt-example
  save my_search
        """
        print(help_text)
    
    def perform_search(self, query, **kwargs):
        """Perform a search and display results."""
        try:
            print(f"Searching for: '{query}' {kwargs}")
            
            start_time = datetime.now()
            results = quilt3.search_packages(query, **kwargs)
            end_time = datetime.now()
            
            duration = (end_time - start_time).total_seconds()
            
            # Store in history
            search_record = {
                "timestamp": start_time.isoformat(),
                "query": query,
                "params": kwargs,
                "result_count": len(results),
                "duration": duration,
                "results": results
            }
            self.search_history.append(search_record)
            
            # Display results
            print(f"Found {len(results)} results in {duration:.2f}s")
            
            if results:
                self.display_results(results)
            else:
                print("No results found.")
                
        except QuiltException as e:
            print(f"Search failed: {e}")
        except Exception as e:
            print(f"Unexpected error: {e}")
    
    def display_results(self, results, max_display=10):
        """Display search results in a readable format."""
        print("-" * 60)
        
        for i, result in enumerate(results[:max_display]):
            print(f"{i+1}. {result.get('name', 'Unknown')}")
            if 'bucket' in result:
                print(f"   Bucket: {result['bucket']}")
            if 'size' in result:
                print(f"   Size: {self.format_size(result['size'])}")
            if 'last_modified' in result:
                print(f"   Modified: {result['last_modified']}")
            if 'metadata' in result and result['metadata']:
                print(f"   Metadata: {json.dumps(result['metadata'], indent=6)}")
            print()
        
        if len(results) > max_display:
            print(f"... and {len(results) - max_display} more results")
        
        print("-" * 60)
    
    def format_size(self, size_bytes):
        """Format file size in human readable format."""
        if not isinstance(size_bytes, (int, float)):
            return str(size_bytes)
            
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size_bytes < 1024.0:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024.0
        return f"{size_bytes:.1f} PB"
    
    def show_history(self):
        """Show search history."""
        if not self.search_history:
            print("No search history available.")
            return
        
        print("Search History:")
        print("-" * 60)
        
        for i, record in enumerate(self.search_history[-10:]):  # Show last 10
            timestamp = datetime.fromisoformat(record["timestamp"]).strftime("%H:%M:%S")
            query = record["query"] or "(empty)"
            params = record.get("params", {})
            count = record["result_count"]
            duration = record["duration"]
            
            param_str = ""
            if params:
                param_str = f" {params}"
            
            print(f"{i+1}. [{timestamp}] '{query}'{param_str} -> {count} results ({duration:.2f}s)")
    
    def save_last_results(self, name):
        """Save last search results with a name."""
        if not self.search_history:
            print("No search results to save.")
            return
        
        last_search = self.search_history[-1]
        self.saved_results[name] = last_search
        print(f"Saved {last_search['result_count']} results as '{name}'")
    
    def show_saved_results(self):
        """Show saved result sets."""
        if not self.saved_results:
            print("No saved results available.")
            return
        
        print("Saved Results:")
        print("-" * 40)
        
        for name, record in self.saved_results.items():
            timestamp = datetime.fromisoformat(record["timestamp"]).strftime("%Y-%m-%d %H:%M")
            query = record["query"] or "(empty)"
            count = record["result_count"]
            print(f"'{name}': {count} results from '{query}' ({timestamp})")
    
    def load_saved_results(self, name):
        """Load and display saved results."""
        if name not in self.saved_results:
            print(f"No saved results found with name '{name}'")
            return
        
        record = self.saved_results[name]
        print(f"Loading saved results: '{name}'")
        print(f"Original query: '{record['query']}'")
        print(f"Search time: {record['timestamp']}")
        
        self.display_results(record["results"])
    
    def compare_saved_results(self, names):
        """Compare two saved result sets."""
        name_list = [n.strip() for n in names.split()]
        
        if len(name_list) != 2:
            print("Usage: compare <name1> <name2>")
            return
        
        name1, name2 = name_list
        
        if name1 not in self.saved_results:
            print(f"No saved results found with name '{name1}'")
            return
            
        if name2 not in self.saved_results:
            print(f"No saved results found with name '{name2}'")
            return
        
        results1 = self.saved_results[name1]["results"]
        results2 = self.saved_results[name2]["results"]
        
        # Compare result sets
        names1 = {r.get('name') for r in results1 if 'name' in r}
        names2 = {r.get('name') for r in results2 if 'name' in r}
        
        common = names1 & names2
        only_in_1 = names1 - names2
        only_in_2 = names2 - names1
        
        print(f"Comparing '{name1}' ({len(results1)} results) vs '{name2}' ({len(results2)} results)")
        print("-" * 60)
        print(f"Common packages: {len(common)}")
        print(f"Only in '{name1}': {len(only_in_1)}")
        print(f"Only in '{name2}': {len(only_in_2)}")
        
        if only_in_1:
            print(f"\nPackages only in '{name1}':")
            for name in sorted(only_in_1)[:5]:  # Show first 5
                print(f"  - {name}")
            if len(only_in_1) > 5:
                print(f"  ... and {len(only_in_1) - 5} more")
        
        if only_in_2:
            print(f"\nPackages only in '{name2}':")
            for name in sorted(only_in_2)[:5]:  # Show first 5
                print(f"  - {name}")
            if len(only_in_2) > 5:
                print(f"  ... and {len(only_in_2) - 5} more")
    
    def search_in_bucket(self, bucket_name):
        """Search within a specific bucket."""
        print(f"Enter search query for bucket '{bucket_name}' (or press Enter for all packages):")
        query = input("bucket query> ").strip()
        
        self.perform_search(query, bucket=bucket_name)
    
    def save_search_results(self, filename=None):
        """Save interesting search results for analysis."""
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"search_results_{timestamp}.json"
        
        export_data = {
            "timestamp": datetime.now().isoformat(),
            "search_history": self.search_history,
            "saved_results": self.saved_results
        }
        
        try:
            with open(filename, 'w') as f:
                json.dump(export_data, f, indent=2)
            print(f"Search session saved to: {filename}")
        except Exception as e:
            print(f"Error saving results: {e}")


def main():
    """Main function."""
    if len(sys.argv) > 1 and sys.argv[1] == '--help':
        print("Interactive Search Explorer for Quilt3")
        print("Usage: python interactive_search_explorer.py")
        print("\nThis tool provides an interactive CLI for exploring search capabilities.")
        return 0
    
    explorer = SearchExplorer()
    explorer.interactive_search_session()
    
    # Optionally save session on exit
    save_session = input("\nSave this search session? (y/N): ").strip().lower()
    if save_session in ['y', 'yes']:
        explorer.save_search_results()
    
    return 0


if __name__ == "__main__":
    sys.exit(main())